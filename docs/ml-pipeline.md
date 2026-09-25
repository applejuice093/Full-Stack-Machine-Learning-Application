# ML pipeline

All learning happens in `ml-service`. The code path is:

```text
bytes
  -> format detection (app/ingestion/parse.py)
  -> rows of strings plus a schema (app/ingestion/model.py)
  -> Parquet at ml-service/data/datasets/{id}.parquet
  -> clean, split, pipeline, search (app/training/train.py)
  -> models/{runId}.joblib
  -> hold-out metrics and PNG charts
  -> one new row through the same pipeline (predict_row)
```

Nothing in this path calls an LLM. Hyperparameters are chosen by cross-validation on the training rows. The hold-out score is reported after that choice.

## 1. Normalize every file to one table

`parse_bytes` rejects pickle and joblib before any loader runs, and rejects image, audio, and video extensions. Other files are classified by magic bytes and then by extension. See `docs/api-and-flow.md` for the extension table.

Every successful parser ends in `from_records` or `from_dataframe`. Cells become text. Missing values are `""`. Floats that are whole numbers are stored without a decimal. Dates become ISO strings. The JSON response keeps at most 2000 preview rows. `all_rows` is what gets written to Parquet, so training is not limited to the preview.

### Column types

`infer_column` looks only at non-empty strings:

| Type | Rule |
|---|---|
| `boolean` | Every value is `true`, `false`, `yes`, or `no` |
| `integer` | Every value matches an optional minus and digits |
| `float` | Every value is an integer or a decimal, including scientific notation |
| `datetime` | Every value matches `YYYY-MM-DD` with an optional time |
| `categorical` | 24 or fewer distinct values, and those are at most half of the non-empty cells |
| `string` | Anything else, including a column that is entirely empty |

ARFF can override this. `NUMERIC` and `REAL` become `float`, `INTEGER` becomes `integer`, a `{a,b,c}` list becomes `categorical`, and `DATE` becomes `datetime`. The nominal list is kept on the dataset metadata. The class attribute, or else the last nominal attribute, is recorded as `targetColumn`. It is not removed.

LIBSVM writes the first token to `label` and each observed `index:value` pair to `f{index}`. Indexes that never appear are not columns. The label is the target.

## 2. Clean the stored table

`prepare_table` runs before the split.

1. Reject a target or feature name that is not in the file.
2. Reject a feature column whose cells are all blank.
3. If drop-duplicates is on, drop rows that are identical on the chosen features plus the target. This happens before the split so the same row cannot sit in both sides. It does not compute a mean or a frequency, so it is not a fitted transform.
4. Drop rows whose target is blank, and count them.
5. Stop if the target then has only one distinct value, or if fewer than 8 rows remain.

For regression, the target is parsed as a number. Any cell that is not a number stops training. Classification keeps the target as text.

## 3. Decide which columns are numeric

`column_roles` calls `infer_column` again on the cleaned feature columns. `integer` and `float` go to the numeric branch. Boolean, categorical, string, and datetime go to the categorical branch. This decision only checks the shape of the text. It does not learn a mean from the test rows.

## 4. Split

`train_test_split` uses the requested `testSize` and `seed`. Classification stratifies when every class has at least two rows, so each fold of the later search can still see every class. If a class has a single row, the split is shuffled without stratification.

The number of CV folds is at most 5. For classification it is also capped by the smallest training class count, and it is at least 2. For regression it is at most half the training rows, and at least 2.

## 5. The preprocessing pipeline

`build_pipeline` returns one scikit-learn `Pipeline`. Grid search and random search call `fit` on that pipeline, so every imputer, scaler, and encoder inside it is fit on the training fold only, then applied to the validation fold. After the search, scikit-learn refits the winner on all training rows. The test rows are not in that refit.

`ColumnTransformer` runs two branches when both kinds of columns exist.

Numeric branch:

- `SimpleImputer` with strategy `median` or `mean`. Median is the default because a few extreme prices or ages do not pull it. Mean is the arithmetic average of the observed training numbers. Empty cells are NaN before this step.
- `StandardScaler` when scaling is on and the model is not naive Bayes. Each column becomes `(value - training mean) / training standard deviation`. The stored mean is the training mean, which is why a column that is mostly zeros in training and large in the hold-out does not change the scaler. Naive Bayes skips the scaler because `GaussianNB` models each feature as a normal distribution. A second standardization is unnecessary, and the implementation leaves the imputed values in their original units.

Categorical branch:

- `SimpleImputer` with strategy `most_frequent`, or `constant` with fill value `missing`. Most frequent replaces a blank with the training mode. Constant marks the blank as its own category instead of pretending it was a real level.
- `OneHotEncoder(handle_unknown="ignore", sparse_output=False)`. A column with levels `north`, `south` becomes two 0/1 columns. A level that appears only in the test row becomes zeros rather than an error. The matrix is dense because the estimators below do not all accept sparse input.

Polynomial regression adds a step in front of `LinearRegression`: `PolynomialFeatures(include_bias=False)`. Degree 2 of features `a` and `b` adds `a^2`, `a*b`, and `b^2`. The bias column is omitted because the linear model already has an intercept. Degree is 2 or 3 when there are at most six features, and only 2 when there are more, so the expanded matrix stays small. This step is inside the pipeline, so the polynomial expansion used in a CV fold is determined by the training fold's columns, not by the test fold.

## 6. Estimators and what the search changes

Each id builds one estimator. The search dictionary is the default space. A request `paramGrid` replaces it entirely.

| Id | Estimator | What is searched | What that parameter does |
|---|---|---|---|
| `logistic_regression` | `LogisticRegression(max_iter=400)` | `C` in 0.1, 1, 10 | Inverse of L2 regularization strength. Smaller `C` pulls coefficients toward zero and is less likely to memorize a small table. The 400-iteration cap is there so a hard problem stops instead of hanging |
| `decision_tree` | `DecisionTreeClassifier` | `max_depth` 3, 5, or unlimited; `min_samples_split` 2 or 4 | Depth limits how many yes/no questions the tree may ask. `min_samples_split` refuses to split a node with fewer rows than that |
| `random_forest` | `RandomForestClassifier` | 20 or 40 trees; depth 3 or unlimited | Each tree sees a bootstrap sample and a subset of features. The prediction is the majority vote. More trees stabilize the vote. Shallow trees reduce memorization |
| `knn` | `KNeighborsClassifier` | `n_neighbors` 3 or 5; weights `uniform` or `distance` | The class is taken from the nearest training rows in the scaled space. Uniform gives each neighbor one vote. Distance gives a closer neighbor a larger vote |
| `naive_bayes` | `GaussianNB` | `var_smoothing` 1e-9 or 1e-8 | Assumes each numeric feature is normal within a class and multiplies those likelihoods by the class frequency. `var_smoothing` adds a fraction of the largest variance so a zero-variance feature does not break the density |
| `svm` | `SVC(probability=True)` | `C` 0.1 or 1; kernel `linear` or `rbf` | Finds a boundary with the widest margin. `C` penalizes points on the wrong side. A linear kernel is a flat boundary. RBF bends the boundary. `probability=True` fits a second calibration so the API can return class probabilities. The default search for this model is random, not grid |
| `linear_regression` | `LinearRegression` | `fit_intercept` true or false | Predicts `w·x + b` by least squares. Turning the intercept off forces the line through the origin |
| `polynomial_regression` | `PolynomialFeatures` then `LinearRegression` | degree 2 or 3; `fit_intercept` | Same least squares, on the expanded features from section 5 |
| `decision_tree_regressor` | `DecisionTreeRegressor` | same depth and split grid as the classifier | Predicts the average target in a leaf instead of a class |
| `random_forest_regressor` | `RandomForestRegressor` | 20 or 40 trees; depth 3 or unlimited | Averages the tree predictions |
| `svr` | `SVR` | `C` 0.1 or 1; `epsilon` 0.1 or 0.2 | Same margin idea as SVC, for a number. Errors smaller than `epsilon` are ignored. Default search is random |

`GridSearchCV` evaluates every combination. `RandomizedSearchCV` draws `min(6, number of combinations)` settings with `random_state` equal to the split seed. Both use `n_jobs=1` and `refit=True`. Classification scoring inside the search is accuracy: the fraction of hold-out-of-the-fold rows whose predicted class matches. Regression scoring inside the search is R²: one minus the ratio of residual variance to target variance. A negative R² means the model is worse than predicting the training mean.

## 7. Metrics after the winner is chosen

`evaluate_holdout` scores `x_test` once. These numbers are stored and shown. They are not passed back into the search.

Classification:

- **Accuracy.** Share of test rows predicted correctly.
- **Precision.** Of the rows predicted as a class, the share that truly are that class. Binary uses the second label in `classes_` as the positive class when both labels appear in the test rows. Otherwise the score is a weighted average across classes. A class with no predicted rows contributes zero instead of an exception (`zero_division=0`).
- **Recall.** Of the rows that truly are a class, the share the model found. Same averaging rules as precision.
- **F1.** Harmonic mean of precision and recall, so a model cannot score well by only inflating one of them.
- **Confusion matrix.** `counts[i][j]` is how many test rows of actual label `labels[i]` were predicted as `labels[j]`.
- **ROC-AUC.** The probability that a random positive row gets a higher score than a random negative row. Binary uses `predict_proba` column 1. More than two classes uses one-vs-rest and averages. The value is null when probabilities are missing or when the test rows do not contain enough classes to draw the curve.

Regression:

- **MAE.** Mean of the absolute difference between actual and predicted.
- **MSE.** Mean of the squared difference. Large misses count more than in MAE.
- **RMSE.** Square root of MSE, so the unit matches the target.
- **R².** Same definition as the search score, computed on the hold-out.

## 8. Charts

`app/visualization/plots.py` draws with Matplotlib's Agg backend and Seaborn. Colors stay in the page palette. Images are PNG.

Dataset charts, from the Parquet table:

- **Distributions.** One figure per column, at most 12. A column that is at least 80 percent numeric becomes a histogram. Anything else becomes a bar of the eight most common labels.
- **Correlation.** Pearson correlation of the numeric columns, annotated on each cell. White text is used when the absolute value is at least 0.55 so the number stays visible on a dark cell. The figure is omitted when fewer than two numeric columns exist.
- **Missing values.** A horizontal bar of empty-cell counts, axis starting at zero. An all-zero table is drawn from 0 to 1 and labeled "No empty cells" instead of zooming onto a hairline at zero.

Evaluation charts are written while the model is saved:

- Classification: confusion-matrix heatmap, and an ROC curve when `rocAuc` is not null. The ROC plot includes the diagonal reference. Multiclass draws one curve per class.
- Regression: actual versus predicted with a y = x line, and residuals (actual minus predicted) versus predicted with a zero line.

`GET /visualize/evaluation/{runId}` reads those PNG files. It does not refit.

## 9. Prediction

`predict_row` loads `models/{runId}.joblib`. The file contains the fitted pipeline, the feature order, the target name, the task, and which columns were numeric or categorical.

The new values are placed in that feature order, cast the same way as training (numbers to float, blanks to missing), and passed to `pipeline.predict`. Imputers and the encoder apply the training-time state. They do not update.

For classification, `predict_proba` supplies a probability per class. `confidence` is the probability of the class that was predicted. Regression returns the float only.

A blank required feature is rejected. An id that is not 32 hex characters, or a missing joblib file, is rejected.

## 10. What this pipeline does not do

- It does not tune a model by its test score.
- It does not run LangGraph, Groq, or Langfuse.
- It does not write the experiment to Postgres.
- It does not accept pickle or joblib uploads, and it loads NumPy with `allow_pickle=False`.
- It does not treat a directory of train and test files as one dataset.
- It does not flatten arrays with three or more dimensions.
