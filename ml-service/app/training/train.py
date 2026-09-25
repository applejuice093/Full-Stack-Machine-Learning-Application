from __future__ import annotations

import json
import re
import time
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, train_test_split

from app.training.pipeline import build_pipeline, column_roles
from app.training.registry import default_search, estimator, model_task, search_space
from app.training.store import load_table
from app.visualization.plots import save_evaluation_figures

MODELS_DIR = Path(__file__).resolve().parents[3] / "models"


class TrainError(Exception):
    pass


def prepare_table(
    frame: pd.DataFrame,
    features: list[str],
    target: str,
    *,
    drop_duplicates: bool = True,
) -> tuple[pd.DataFrame, int, int]:
    missing = [column for column in [*features, target] if column not in frame.columns]
    if missing:
        raise TrainError(f"These columns are not in the dataset: {', '.join(missing)}.")
    empty = [column for column in features if frame[column].astype(str).str.strip().eq("").all()]
    if empty:
        raise TrainError(f"{empty[0]} has no values to train on.")
    before = len(frame)
    if drop_duplicates:
        working = frame.drop_duplicates(subset=[*features, target]).copy()
    else:
        working = frame.copy()
    removed_duplicates = before - len(working)
    target_text = working[target].astype(str).str.strip()
    removed_target = int(target_text.eq("").sum())
    working = working.loc[target_text.ne("")].copy()
    if working[target].astype(str).nunique() < 2:
        raise TrainError("The target has only one value after cleaning, so a model cannot be trained.")
    if len(working) < 8:
        raise TrainError("At least 8 rows are required after removing duplicates and empty targets.")
    return working, removed_duplicates, removed_target


def split_table(frame: pd.DataFrame, features: list[str], target: str, task: str, test_size: float, seed: int):
    assigned = model_safe_target(frame[target], task)
    stratify = None
    if task == "classification":
        counts = assigned.value_counts()
        if counts.min() >= 2 and len(counts) > 1:
            stratify = assigned
    return train_test_split(
        frame[features],
        assigned,
        test_size=test_size,
        random_state=seed,
        stratify=stratify,
    )


def model_safe_target(series: pd.Series, task: str) -> pd.Series:
    if task == "regression":
        numeric = pd.to_numeric(series, errors="coerce")
        if numeric.isna().any():
            raise TrainError("Regression needs a numeric target. Choose a number column.")
        return numeric
    return series.astype(str)


def train_dataset(
    dataset_id: str,
    *,
    features: list[str],
    target: str,
    task: str,
    model_id: str,
    search: str | None,
    test_size: float,
    seed: int,
    param_grid: dict | None,
    numeric_impute: str = "median",
    categorical_impute: str = "most_frequent",
    scale: bool = True,
    drop_duplicates: bool = True,
) -> dict:
    if target in features:
        raise TrainError("The target column cannot also be an input.")
    if not features:
        raise TrainError("Choose at least one input column.")
    try:
        expected = model_task(model_id)
    except KeyError as exc:
        raise TrainError(f"Unknown model: {model_id}.") from exc
    if expected != task:
        raise TrainError(f"{model_id} is a {expected} model. The selected task is {task}.")
    if search not in {None, "grid", "random"}:
        raise TrainError("Search method must be grid or random.")

    try:
        stored = load_table(dataset_id)
    except FileNotFoundError as exc:
        raise TrainError(str(exc)) from exc

    prepared, removed_duplicates, removed_target = prepare_table(
        stored,
        features,
        target,
        drop_duplicates=drop_duplicates,
    )
    features_frame = prepared[features].astype(str)
    numeric, categorical = column_roles(features_frame, features)
    x_train, x_test, y_train, y_test = split_table(prepared, features, target, task, test_size, seed)
    x_train = _cast(x_train.astype(str), numeric, categorical)
    x_test = _cast(x_test.astype(str), numeric, categorical)

    folds = _folds(y_train, task)
    chosen_search = search or default_search(model_id)
    space = param_grid or search_space(model_id, len(features))
    scaling_applied = scale and model_id != "naive_bayes"
    pipeline = build_pipeline(
        model_id,
        estimator(model_id),
        numeric,
        categorical,
        numeric_impute=numeric_impute,
        categorical_impute=categorical_impute,
        scale=scale,
    )
    scoring = "accuracy" if task == "classification" else "r2"
    started = time.perf_counter()
    if chosen_search == "grid":
        searcher = GridSearchCV(pipeline, space, cv=folds, scoring=scoring, n_jobs=1, refit=True)
    else:
        searcher = RandomizedSearchCV(
            pipeline,
            space,
            n_iter=min(6, _grid_size(space)),
            cv=folds,
            scoring=scoring,
            random_state=seed,
            n_jobs=1,
            refit=True,
        )
    searcher.fit(x_train, y_train)
    duration = time.perf_counter() - started
    best = searcher.best_estimator_
    prediction = best.predict(x_test)
    evaluation = evaluate_holdout(task, y_test, prediction, best, x_test)
    if task == "classification":
        test_score = float(evaluation["accuracy"])
    else:
        test_score = float(evaluation["r2"])

    run_id = uuid4().hex
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    artifact = {
        "pipeline": best,
        "features": features,
        "target": target,
        "task": task,
        "modelId": model_id,
        "numeric": numeric,
        "categorical": categorical,
    }
    joblib.dump(artifact, MODELS_DIR / f"{run_id}.joblib")
    figures = save_evaluation_figures(run_id, task, y_test, prediction, best, x_test, evaluation)
    summary = {
        "runId": run_id,
        "datasetId": dataset_id,
        "modelId": model_id,
        "task": task,
        "searchMethod": chosen_search,
        "parameterSpace": {key: _plain(value) for key, value in space.items()},
        "bestParameters": {key: _plain(value) for key, value in searcher.best_params_.items()},
        "cvFolds": folds,
        "bestCvScore": float(searcher.best_score_),
        "testScore": test_score,
        "scoring": scoring,
        "evaluation": evaluation,
        "figures": figures,
        "trainRows": int(len(x_train)),
        "testRows": int(len(x_test)),
        "removedDuplicates": int(removed_duplicates),
        "removedMissingTargets": int(removed_target),
        "durationSeconds": round(duration, 3),
        "preprocessing": {
            "numericImpute": numeric_impute if numeric_impute in {"median", "mean"} else "median",
            "categoricalImpute": categorical_impute,
            "scale": scaling_applied,
            "encoding": "one_hot" if categorical else "none",
            "dropDuplicates": drop_duplicates,
            "testSize": test_size,
        },
    }
    (MODELS_DIR / f"{run_id}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def evaluate_holdout(task: str, y_test: pd.Series, prediction, pipeline, x_test: pd.DataFrame) -> dict:
    if task == "regression":
        mse = float(mean_squared_error(y_test, prediction))
        return {
            "mae": float(mean_absolute_error(y_test, prediction)),
            "mse": mse,
            "rmse": float(np.sqrt(mse)),
            "r2": float(r2_score(y_test, prediction)),
        }
    labels = [str(label) for label in getattr(pipeline, "classes_", pd.unique(y_test))]
    actual = y_test.astype(str)
    predicted = pd.Series(prediction).astype(str)
    matrix = confusion_matrix(actual, predicted, labels=labels)
    both_present = len(labels) == 2 and set(actual.unique()) == set(labels)
    average = "binary" if both_present else "weighted"
    binary_kwargs = {"pos_label": labels[1]} if average == "binary" else {}
    report = {
        "accuracy": float(accuracy_score(actual, predicted)),
        "precision": float(precision_score(actual, predicted, average=average, zero_division=0, **binary_kwargs)),
        "recall": float(recall_score(actual, predicted, average=average, zero_division=0, **binary_kwargs)),
        "f1": float(f1_score(actual, predicted, average=average, zero_division=0, **binary_kwargs)),
        "confusionMatrix": {"labels": labels, "counts": matrix.tolist()},
    }
    if hasattr(pipeline, "predict_proba"):
        try:
            probabilities = pipeline.predict_proba(x_test)
            if len(labels) == 2:
                report["rocAuc"] = float(roc_auc_score(actual, probabilities[:, 1]))
            elif len(labels) > 2:
                report["rocAuc"] = float(roc_auc_score(actual, probabilities, multi_class="ovr", labels=labels))
        except ValueError:
            report["rocAuc"] = None
    else:
        report["rocAuc"] = None
    return report


def predict_row(run_id: str, values: dict) -> dict:
    if not re.fullmatch(r"^[a-f0-9]{32}$", run_id):
        raise TrainError("Unknown trained model.")
    path = MODELS_DIR / f"{run_id}.joblib"
    if not path.exists():
        raise TrainError("That trained model is no longer available. Train it again.")
    artifact = joblib.load(path)
    features = artifact["features"]
    missing = [feature for feature in features if str(values.get(feature, "")).strip() == ""]
    if missing:
        raise TrainError(f"Enter a value for {missing[0]}.")
    row = _cast(
        pd.DataFrame([{feature: values[feature] for feature in features}]).astype(str),
        artifact["numeric"],
        artifact["categorical"],
    )
    pipeline = artifact["pipeline"]
    predicted = pipeline.predict(row)[0]
    if artifact["task"] == "regression":
        return {"prediction": float(predicted), "task": "regression"}
    label = str(predicted)
    result = {"prediction": label, "task": "classification"}
    if hasattr(pipeline, "predict_proba"):
        probabilities = pipeline.predict_proba(row)[0]
        classes = [str(item) for item in pipeline.classes_]
        by_class = {classes[index]: float(probabilities[index]) for index in range(len(classes))}
        result["probabilities"] = by_class
        result["confidence"] = by_class.get(label)
    return result


def _cast(frame: pd.DataFrame, numeric: list[str], categorical: list[str]) -> pd.DataFrame:
    casted = pd.DataFrame(index=frame.index)
    for column in numeric:
        casted[column] = pd.to_numeric(frame[column], errors="coerce")
    for column in categorical:
        casted[column] = frame[column].replace("", pd.NA)
    return casted


def _folds(y_train: pd.Series, task: str) -> int:
    if task == "classification":
        smallest = int(y_train.astype(str).value_counts().min())
        return max(2, min(5, smallest))
    return max(2, min(5, len(y_train) // 2))


def _grid_size(space: dict) -> int:
    size = 1
    for values in space.values():
        size *= max(len(list(values)), 1)
    return size


def _plain(value):
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
