# API, user flow, and product details

The browser calls Express. Express calls FastAPI. In local development the Vite server on port 5173 proxies the paths below to port 4000, except that a second parse attempt may call `/dataset/parse` on port 8000 directly if Express did not answer.

Errors use `{ "detail": "message" }`. A 400 means the file or the request was rejected. A 503 means Express could not reach FastAPI.

## User flow

The header order is the product order. State is kept in the open tab. A later page tells you which earlier step is missing and links back. There is no account and no saved session.

1. **Upload** (`/`). Drop a file, browse, or use the sample house table. The service stores the full table and returns an id. The page shows the file name, row count, column count, column types, and six sample rows. If the file has several sheets or arrays, pick one. Dataset charts load for that id: one distribution per column (open one, **<** returns to the grid), then correlation and missing-value charts. Each of those two charts can open full screen. **Exit full screen**, **<**, or Escape closes it without jumping to the bottom of the page.
2. **Configure** (`/configure`). Choose the target, the input columns, and classification or regression. Set how missing numbers and categories are filled, whether numbers are standardized, whether exact duplicate rows are removed, and what fraction of rows is held out.
3. **Train** (`/train`). Pick an algorithm that matches the task. Choose grid or random search. **Train model** fits the pipeline, searches parameters on training rows only, scores the hold-out once, and saves the pipeline.
4. **Evaluate** (`/evaluate`). Read the metrics and the chart for that saved run. Classification shows accuracy, precision, recall, F1, the confusion matrix, ROC-AUC when it exists, and the heatmap and ROC images. Regression shows MAE, MSE, RMSE, R², the actual-versus-predicted plot, and the residual plot.
5. **Predict** (`/predict`). Type one value per selected input. The saved pipeline returns a class or a number. Classification also returns a confidence percentage.

Removing the file clears the in-memory dataset and the train result. It does not delete the Parquet file or the joblib file.

## `GET /health`

Express and FastAPI each expose this.

```json
{ "status": "ok", "service": "backend" }
```

The Python body uses `"service": "ml-service"`.

## `POST /datasets/parse`

Multipart field `file`. Optional text field `member` (sheet name, NumPy array name, or HDF5 path).

Express limit: 8 MB. FastAPI also rejects empty files and files over 8 MB.

Success body:

| Field | Meaning |
|---|---|
| `filename`, `originalFilename` | Uploaded name |
| `sourceFormat` | Detected kind, such as `delimited`, `excel`, `arff`, `libsvm` |
| `outputFormat` | Always `csv` in the normalized sense. The response is JSON, not a CSV download |
| `headers` | Column names |
| `rows` | Preview, at most 2000 rows, cells as strings. Empty string means missing |
| `rowCount`, `columnCount` | Full table size, not just the preview |
| `schema` | `{ name, inferredType, missingCount, uniqueCount }` per column |
| `missingValues` | Total empty cells |
| `targetColumn` | Set for ARFF and LIBSVM. Null for ordinary tables |
| `metadata` | Format extras: `candidates`, `selectedMember`, `relation`, `nominalValues`, sparse feature counts |
| `datasetId` | 32 hex characters. Points at the Parquet file used by training and charts |

`inferredType` is one of `integer`, `float`, `boolean`, `categorical`, `string`, `datetime`.

A format that defines a label does not delete that column. The UI preselects it as the target.

## `POST /datasets/store`

JSON. Used when the table was parsed in the browser (sample button, or CSV while the service was down).

```json
{ "filename": "sample-houses.csv", "headers": ["rooms", "price"], "rows": [["3", "310000"]] }
```

Response: `{ "datasetId": "..." }`. An empty table is 400.

The Express JSON limit is 2 MB, so a very large browser-side table can fail this call even though a direct file upload allows 8 MB.

## `POST /visualize/dataset`

```json
{ "datasetId": "..." }
```

Response:

```json
{
  "distributions": [{ "name": "rooms", "image": "<base64 png>" }],
  "correlation": "<base64 png or null>",
  "missing": "<base64 png>",
  "notes": ["Fewer than two numeric columns, so there is no correlation heatmap."]
}
```

At most the first 12 columns get a distribution chart. Correlation is omitted when fewer than two columns are numeric. The missing chart counts empty cells. If every count is zero, the axis still runs from 0 to 1 and the figure says "No empty cells".

## `POST /train`

```json
{
  "datasetId": "abc...",
  "target": "sold",
  "features": ["rooms", "neighborhood"],
  "task": "classification",
  "modelId": "logistic_regression",
  "search": "grid",
  "testSize": 0.2,
  "seed": 42,
  "numericImpute": "median",
  "categoricalImpute": "most_frequent",
  "scale": true,
  "dropDuplicates": true
}
```

`search` may be omitted. SVM and SVR then use random search. Every other model uses grid search. `testSize` must be greater than 0.05 and less than 0.5. `paramGrid` is optional and replaces the built-in space. Keys must match the pipeline, for example `model__C`.

`modelId` must belong to `task`. Classification ids: `logistic_regression`, `decision_tree`, `random_forest`, `knn`, `naive_bayes`, `svm`. Regression ids: `linear_regression`, `polynomial_regression`, `decision_tree_regressor`, `random_forest_regressor`, `svr`.

Success includes `runId`, `bestParameters`, `parameterSpace`, `bestCvScore`, `testScore`, `scoring` (`accuracy` or `r2`), `cvFolds`, `searchMethod`, `trainRows`, `testRows`, `removedDuplicates`, `removedMissingTargets`, `durationSeconds`, `preprocessing`, `evaluation`, and `figures`.

`preprocessing` echoes the impute choices, whether scaling actually ran, `encoding` (`one_hot` or `none`), `dropDuplicates`, and `testSize`.

Classification `evaluation`:

| Field | Meaning |
|---|---|
| `accuracy`, `precision`, `recall`, `f1` | On the hold-out. Weighted averages when there are more than two classes, or when the hold-out does not contain both classes |
| `rocAuc` | Number, or null when probabilities are missing or ROC is undefined |
| `confusionMatrix.labels` | Class names |
| `confusionMatrix.counts` | Rows are actual, columns are predicted, same order as `labels` |

Regression `evaluation`: `mae`, `mse`, `rmse`, `r2`.

`figures` names the PNG files written beside the model: `confusion` and `roc` for classification, `actual` and `residual` for regression. `roc` is absent when ROC-AUC is null.

The fitted pipeline is `models/{runId}.joblib`. The same summary is `models/{runId}.json`.

Typical 400 messages: unknown dataset, target also listed as an input, unknown model, task does not match the model, target has one value, fewer than 8 rows after cleaning, regression target is not numeric, a chosen column is empty.

## `GET /visualize/evaluation/{runId}`

`runId` must be 32 hex characters.

```json
{ "images": { "confusion": "<base64 png>", "roc": "<base64 png>" } }
```

Only files that were written are included. An unknown id is 400.

## `POST /predict`

```json
{ "runId": "abc...", "values": { "rooms": "4", "neighborhood": "north" } }
```

Every feature stored in the joblib file must be non-empty. The service does not refit.

Classification:

```json
{
  "prediction": "yes",
  "task": "classification",
  "confidence": 0.563,
  "probabilities": { "yes": 0.563, "no": 0.437 }
}
```

`confidence` is the probability of the predicted class. It is omitted if the estimator has no `predict_proba`.

Regression:

```json
{ "prediction": 348120.5, "task": "regression" }
```

There is no confidence field.

## Formats the parser accepts

Detection uses the extension, then magic bytes (`\x93NUMPY`, `PAR1`, HDF5, `MATLAB`, `ARROW1`, zip). `.dat` is treated as LIBSVM when the lines look like `label index:value`. Otherwise `.dat`, `.csv`, `.tsv`, and `.txt` are delimited text. The sniffer tries comma, tab, semicolon, and pipe.

| Kind | Extensions | Notes |
|---|---|---|
| Delimited | `.csv`, `.tsv`, `.txt`, `.dat` | Quoted fields. Header row required. Duplicate header names get a numeric suffix |
| Excel | `.xlsx`, `.xlsm`, `.xls` | First non-empty sheet unless `member` names one. Macros are not run. `.xls` needs xlrd |
| ARFF | `.arff` | Reads `@RELATION`, `@ATTRIBUTE`, `@DATA`. `?` is missing. Sparse `{index value}` rows are supported. Nominal lists are kept in metadata |
| LIBSVM | `.libsvm`, `.svm`, some `.dat` | Label plus `index:value`. Only observed indexes become columns `f1`, `f2`, ... More than 2000 observed features is rejected instead of building a huge dense table |
| NumPy | `.npy`, `.npz` | `allow_pickle=False`. 1D becomes column `value`. 2D becomes `f1`... 3D and higher is rejected. Several compatible `.npz` arrays are listed in `candidates` |
| Columnar | `.parquet`, `.feather`, `.arrow` | Arrow IPC and Feather through PyArrow |
| HDF5 | `.h5`, `.hdf5` | Only 1D and 2D datasets. Paths are listed. `member` selects one |
| MATLAB | `.mat` | v7 matrices and vectors. v7.3 (HDF5) uses the HDF5 reader. Object arrays are skipped |
| JSON | `.json` | Array of objects, or `{ "data": [ ... ] }`. Nested objects become `parent.child`. Nested arrays are kept as JSON text |
| JSON lines | `.jsonl`, `.ndjson` | One object per line |
| YAML | `.yaml`, `.yml` | A list of objects, via `yaml.safe_load` only |
| XML | `.xml` | Repeating child elements with the same tag and simple fields or attributes. Mixed tags are rejected |
| Statistics | `.sav`, `.dta`, `.sas7bdat`, `.xpt` | Read with pyreadstat |
| R | `.rds`, `.RData`, `.rda` | Read with pyreadr. No R code is executed. If the file cannot be read, the detail is `R serialization format is not currently supported in this environment.` |

Refused:

- `.pkl`, `.pickle`, `.joblib`: `Python serialized model/data files are not accepted for security reasons. Export the dataset to CSV, Parquet, NumPy or another supported data format.`
- Images and audio/video (`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.gif`, `.mp3`, `.wav`, `.flac`, `.mp4`, `.avi`, `.mov`): `This is a multimedia file, not a tabular dataset. Bench currently requires structured/tabular data.`
- A folder of train/test files is not an upload type. The UI has no directory picker.

## What is prepared but not used

- Sign-in is not implemented. The example workflow does not start with an account.
- Postgres and pgvector are started by Docker Compose and the SQL file creates the tables. No route queries them.
- Groq, LangGraph, and Langfuse environment variables are unused.
- `POST /dataset/analyze` does not exist. Dataset analysis is `POST /visualize/dataset` plus the schema returned by parse.
