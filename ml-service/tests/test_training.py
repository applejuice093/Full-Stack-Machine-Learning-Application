import joblib
import pandas as pd
import pytest

from app.training.store import load_table, save_table
from app.visualization.plots import dataset_figures, load_evaluation_figures
from app.training.train import TrainError, predict_row, prepare_table, split_table, train_dataset
from pathlib import Path


def _classification_rows() -> list[list[str]]:
    rows = []
    for index in range(24):
        rows.append([str(index % 5), "a" if index % 2 == 0 else "b", "0" if index < 12 else "1"])
    rows.append(rows[0])
    return rows


def test_dataset_figures_and_single_numeric_column() -> None:
    mixed = save_table(
        ["x", "y", "group"],
        [[str(i), str(i * 2), "a" if i % 2 == 0 else "b"] for i in range(12)],
        "mix.csv",
    )
    figures = dataset_figures(load_table(mixed))
    assert figures["distributions"]
    assert figures["distributions"][0]["name"] == "x"
    assert figures["distributions"][0]["image"]
    assert figures["correlation"]
    assert figures["missing"]
    single = save_table(["x"], [[str(i)] for i in range(8)], "one.csv")
    one = dataset_figures(load_table(single))
    assert one["correlation"] is None
    assert one["distributions"] and one["missing"]


def test_duplicates_are_removed_before_training() -> None:
    rows = [[str(index), "a", "0" if index < 6 else "1"] for index in range(12)]
    rows.append(rows[0])
    frame = pd.DataFrame(rows, columns=["x", "group", "label"])
    prepared, removed, _missing = prepare_table(frame, ["x", "group"], "label")
    assert removed == 1
    assert len(prepared) == 12


def test_scaler_learns_from_the_training_split_only() -> None:
    headers = ["row", "x", "label"]
    rows = [[str(index), "0" if index < 18 else "80", "0" if index % 2 == 0 else "1"] for index in range(24)]
    dataset_id = save_table(headers, rows, "scale.csv")
    summary = train_dataset(
        dataset_id,
        features=["row", "x"],
        target="label",
        task="classification",
        model_id="logistic_regression",
        search="grid",
        test_size=0.25,
        seed=1,
        param_grid=None,
    )
    stored = load_table(dataset_id)
    prepared, _, _ = prepare_table(stored, ["row", "x"], "label")
    x_train, _, _, _ = split_table(prepared, ["row", "x"], "label", "classification", 0.25, 1)
    artifact = joblib.load(Path(__file__).resolve().parents[2] / "models" / f"{summary['runId']}.joblib")
    learned = artifact["pipeline"].named_steps["preprocess"].named_transformers_["num"].named_steps["scaler"].mean_[1]
    train_mean = pd.to_numeric(x_train["x"]).mean()
    full_mean = pd.to_numeric(prepared["x"]).mean()
    assert learned == pytest.approx(train_mean)
    assert learned != pytest.approx(full_mean)
    assert summary["bestParameters"]
    assert summary["testScore"] is not None


def test_random_forest_and_svm_finish() -> None:
    dataset_id = save_table(["x", "group", "label"], _classification_rows(), "clf.csv")
    forest = train_dataset(
        dataset_id,
        features=["x", "group"],
        target="label",
        task="classification",
        model_id="random_forest",
        search="grid",
        test_size=0.25,
        seed=2,
        param_grid={"model__n_estimators": [10], "model__max_depth": [3]},
    )
    svm = train_dataset(
        dataset_id,
        features=["x", "group"],
        target="label",
        task="classification",
        model_id="svm",
        search="random",
        test_size=0.25,
        seed=2,
        param_grid={"model__C": [1.0], "model__kernel": ["linear"]},
    )
    matrix = forest["evaluation"]["confusionMatrix"]["counts"]
    assert sum(sum(row) for row in matrix) == forest["testRows"]
    for name in ("accuracy", "precision", "recall", "f1"):
        assert name in forest["evaluation"]
    assert "confusion" in load_evaluation_figures(forest["runId"])
    assert "confusion" in forest["figures"]
    assert "roc" in forest["figures"]
    assert forest["searchMethod"] == "grid"
    assert svm["searchMethod"] == "random"
    assert "model__n_estimators" in forest["bestParameters"]


def test_regression_and_rejections() -> None:
    rows = [[str(index), str(index * 2)] for index in range(20)]
    dataset_id = save_table(["x", "y"], rows, "reg.csv")
    summary = train_dataset(
        dataset_id,
        features=["x"],
        target="y",
        task="regression",
        model_id="polynomial_regression",
        search="grid",
        test_size=0.2,
        seed=3,
        param_grid={"model__poly__degree": [2], "model__reg__fit_intercept": [True]},
    )
    assert summary["bestParameters"]["model__poly__degree"] == 2
    for name in ("mae", "mse", "rmse", "r2"):
        assert name in summary["evaluation"]
    assert "actual" in summary["figures"]
    assert "residual" in summary["figures"]
    predicted = predict_row(summary["runId"], {"x": "3"})
    assert isinstance(predicted["prediction"], float)
    with pytest.raises(TrainError, match="Enter a value"):
        predict_row(summary["runId"], {"x": ""})

    with pytest.raises(TrainError, match="Unknown model"):
        train_dataset(
            dataset_id,
            features=["x"],
            target="y",
            task="regression",
            model_id="not_a_model",
            search="grid",
            test_size=0.2,
            seed=3,
            param_grid=None,
        )
    constant = save_table(["x", "y"], [["1", "5"] for _ in range(10)], "constant.csv")
    with pytest.raises(TrainError, match="only one value"):
        train_dataset(
            constant,
            features=["x"],
            target="y",
            task="regression",
            model_id="linear_regression",
            search="grid",
            test_size=0.2,
            seed=3,
            param_grid=None,
        )
