from __future__ import annotations

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, PolynomialFeatures, StandardScaler

from app.ingestion.model import infer_column


def column_roles(frame: pd.DataFrame, features: list[str]) -> tuple[list[str], list[str]]:
    numeric: list[str] = []
    categorical: list[str] = []
    for feature in features:
        values = ["" if value is None else str(value) for value in frame[feature].tolist()]
        kind, _, _ = infer_column(values)
        if kind in {"integer", "float"}:
            numeric.append(feature)
        else:
            categorical.append(feature)
    return numeric, categorical


def build_pipeline(
    model_id: str,
    estimator,
    numeric: list[str],
    categorical: list[str],
    *,
    numeric_impute: str = "median",
    categorical_impute: str = "most_frequent",
    scale: bool = True,
) -> Pipeline:
    scale = scale and model_id != "naive_bayes"
    numeric_strategy = "mean" if numeric_impute == "mean" else "median"
    categorical_strategy = "constant" if categorical_impute == "constant" else "most_frequent"
    numeric_steps = [("imputer", SimpleImputer(strategy=numeric_strategy))]
    if scale:
        numeric_steps.append(("scaler", StandardScaler()))
    transformers = []
    if numeric:
        transformers.append(("num", Pipeline(numeric_steps), numeric))
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        (
                            "imputer",
                            SimpleImputer(strategy=categorical_strategy, fill_value="missing"),
                        ),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                categorical,
            )
        )
    preprocess = ColumnTransformer(transformers)
    if model_id == "polynomial_regression":
        model = Pipeline(
            [
                ("poly", PolynomialFeatures(include_bias=False)),
                ("reg", estimator),
            ]
        )
    else:
        model = estimator
    return Pipeline([("preprocess", preprocess), ("model", model)])
