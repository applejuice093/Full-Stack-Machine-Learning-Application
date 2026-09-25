from __future__ import annotations

import base64
import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import roc_curve

MODELS_DIR = Path(__file__).resolve().parents[3] / "models"

INK = "#171717"
PAPER = "#F7F6F2"
STONE = "#9A927F"
LINE = "#D8D6CF"
MAX_DISTRIBUTION_COLUMNS = 12


def dataset_figures(frame: pd.DataFrame) -> dict:
    notes: list[str] = []
    correlation, correlation_note = _correlation(frame)
    if correlation_note:
        notes.append(correlation_note)
    missing = _missing(frame)
    return {
        "distributions": _distributions(frame),
        "correlation": _png(correlation) if correlation is not None else None,
        "missing": _png(missing),
        "notes": notes,
    }


def save_evaluation_figures(run_id: str, task: str, y_test, prediction, pipeline, x_test, evaluation: dict) -> list[str]:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    if task == "classification":
        _write(run_id, "confusion", _confusion(evaluation))
        saved.append("confusion")
        roc = _roc(y_test, pipeline, x_test, evaluation)
        if roc is not None:
            _write(run_id, "roc", roc)
            saved.append("roc")
    else:
        _write(run_id, "actual", _actual_vs_predicted(y_test, prediction))
        saved.append("actual")
        _write(run_id, "residual", _residuals(y_test, prediction))
        saved.append("residual")
    return saved


def load_evaluation_figures(run_id: str) -> dict[str, str]:
    if not __import__("re").fullmatch(r"^[a-f0-9]{32}$", run_id):
        raise FileNotFoundError("Unknown trained model.")
    images: dict[str, str] = {}
    for name in ("confusion", "roc", "actual", "residual"):
        path = MODELS_DIR / f"{run_id}-{name}.png"
        if path.exists():
            images[name] = base64.b64encode(path.read_bytes()).decode("ascii")
    if not images and not (MODELS_DIR / f"{run_id}.joblib").exists():
        raise FileNotFoundError("That trained model is no longer available. Train it again.")
    return images


def _write(run_id: str, name: str, figure) -> None:
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", dpi=120, bbox_inches="tight", facecolor=PAPER)
    plt.close(figure)
    (MODELS_DIR / f"{run_id}-{name}.png").write_bytes(buffer.getvalue())


def _png(figure) -> str:
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", dpi=130, bbox_inches="tight", pad_inches=0.12, facecolor="white")
    plt.close(figure)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _style_ax(ax) -> None:
    ax.set_facecolor("white")
    ax.tick_params(colors=INK, labelsize=8)
    for spine in ax.spines.values():
        spine.set_color(LINE)


def _distributions(frame: pd.DataFrame) -> list[dict[str, str]]:
    charts: list[dict[str, str]] = []
    for column in list(frame.columns)[:MAX_DISTRIBUTION_COLUMNS]:
        fig, ax = plt.subplots(figsize=(5.2, 3.4), facecolor="white")
        _style_ax(ax)
        numeric = pd.to_numeric(frame[column], errors="coerce")
        if numeric.notna().mean() >= 0.8:
            ax.hist(numeric.dropna(), color=STONE, edgecolor=INK, bins=min(10, max(numeric.nunique(), 1)))
            ax.set_ylabel("Rows", color=INK)
        else:
            counts = frame[column].replace("", pd.NA).dropna().astype(str).value_counts().head(8)
            ax.bar(range(len(counts)), counts.to_numpy(), color=STONE, edgecolor=INK)
            ax.set_xticks(range(len(counts)))
            ax.set_xticklabels(list(counts.index), rotation=25, ha="right")
            ax.set_ylabel("Rows", color=INK)
        ax.set_title(str(column), color=INK, fontsize=12, pad=8)
        fig.tight_layout()
        charts.append({"name": str(column), "image": _png(fig)})
    return charts


def _correlation(frame: pd.DataFrame):
    numeric = pd.DataFrame({column: pd.to_numeric(frame[column], errors="coerce") for column in frame.columns})
    keep = [column for column in numeric.columns if numeric[column].notna().mean() >= 0.8]
    if len(keep) < 2:
        return None, "Fewer than two numeric columns, so there is no correlation heatmap."
    size = max(6.0, 0.85 * len(keep) + 2)
    fig, ax = plt.subplots(figsize=(size, size * 0.85), facecolor="white")
    matrix = numeric[keep].corr()
    sns.heatmap(
        matrix,
        ax=ax,
        cmap="Greys",
        vmin=-1,
        vmax=1,
        annot=False,
        square=False,
        linewidths=0.6,
        linecolor="white",
        cbar_kws={"shrink": 0.8, "label": "Correlation"},
    )
    for row_index, row_name in enumerate(matrix.index):
        for column_index, column_name in enumerate(matrix.columns):
            value = float(matrix.loc[row_name, column_name])
            ax.text(
                column_index + 0.5,
                row_index + 0.5,
                f"{value:.2f}",
                ha="center",
                va="center",
                color="white" if abs(value) >= 0.55 else INK,
                fontsize=9,
            )
    ax.set_title("Correlation", color=INK, fontsize=12, pad=12)
    ax.set_xticklabels(ax.get_xticklabels(), rotation=40, ha="right")
    ax.set_yticklabels(ax.get_yticklabels(), rotation=0)
    fig.tight_layout()
    return fig, None


def _missing(frame: pd.DataFrame):
    missing = frame.astype(str).apply(lambda series: series.str.strip().eq("") | series.str.lower().isin({"nan", "none", "<na>"}))
    counts = missing.sum().astype(int)
    height = max(3.2, 0.55 * len(counts) + 1.2)
    fig, ax = plt.subplots(figsize=(7.2, height), facecolor="white")
    _style_ax(ax)
    positions = range(len(counts))
    ax.barh(list(positions), counts.to_numpy(), color=STONE, edgecolor=INK, height=0.65)
    ax.set_yticks(list(positions))
    ax.set_yticklabels(counts.index.astype(str))
    upper = max(int(counts.max()), 1)
    ax.set_xlim(0, upper if counts.max() > 0 else 1)
    ax.set_xlabel("Empty cells", color=INK)
    ax.set_title("Missing values", color=INK, fontsize=12)
    if int(counts.max()) == 0:
        ax.text(0.5, 0.5, "No empty cells", transform=ax.transAxes, ha="center", va="center", color=INK)
    fig.tight_layout()
    return fig


def _confusion(evaluation: dict):
    matrix = np.array(evaluation["confusionMatrix"]["counts"])
    labels = evaluation["confusionMatrix"]["labels"]
    fig, ax = plt.subplots(figsize=(5.5, 4.5), facecolor=PAPER)
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Greys", xticklabels=labels, yticklabels=labels, ax=ax)
    ax.set_xlabel("Predicted", color=INK)
    ax.set_ylabel("Actual", color=INK)
    ax.set_title("Confusion matrix", color=INK, fontsize=12)
    fig.tight_layout()
    return fig


def _roc(y_test, pipeline, x_test, evaluation: dict):
    if evaluation.get("rocAuc") is None or not hasattr(pipeline, "predict_proba"):
        return None
    labels = [str(label) for label in pipeline.classes_]
    actual = pd.Series(y_test).astype(str)
    probabilities = pipeline.predict_proba(x_test)
    fig, ax = plt.subplots(figsize=(5.5, 4.5), facecolor=PAPER)
    _style_ax(ax)
    if len(labels) == 2:
        fpr, tpr, _ = roc_curve(actual, probabilities[:, 1], pos_label=labels[1])
        ax.plot(fpr, tpr, color=INK, label=labels[1])
    else:
        for index, label in enumerate(labels):
            fpr, tpr, _ = roc_curve((actual == label).astype(int), probabilities[:, index])
            ax.plot(fpr, tpr, label=label)
        ax.legend(frameon=False)
    ax.plot([0, 1], [0, 1], color=LINE, linestyle="--")
    ax.set_xlabel("False positive rate", color=INK)
    ax.set_ylabel("True positive rate", color=INK)
    ax.set_title("ROC curve", color=INK, fontsize=12)
    fig.tight_layout()
    return fig


def _actual_vs_predicted(y_test, prediction):
    actual = np.asarray(y_test, dtype=float)
    predicted = np.asarray(prediction, dtype=float)
    fig, ax = plt.subplots(figsize=(5.5, 4.5), facecolor=PAPER)
    _style_ax(ax)
    ax.scatter(actual, predicted, color=STONE, edgecolor=INK)
    low = float(min(actual.min(), predicted.min()))
    high = float(max(actual.max(), predicted.max()))
    ax.plot([low, high], [low, high], color=INK)
    ax.set_xlabel("Actual", color=INK)
    ax.set_ylabel("Predicted", color=INK)
    ax.set_title("Actual vs predicted", color=INK, fontsize=12)
    fig.tight_layout()
    return fig


def _residuals(y_test, prediction):
    actual = np.asarray(y_test, dtype=float)
    predicted = np.asarray(prediction, dtype=float)
    fig, ax = plt.subplots(figsize=(5.5, 4.5), facecolor=PAPER)
    _style_ax(ax)
    ax.scatter(predicted, actual - predicted, color=STONE, edgecolor=INK)
    ax.axhline(0, color=INK)
    ax.set_xlabel("Predicted", color=INK)
    ax.set_ylabel("Residual", color=INK)
    ax.set_title("Residuals", color=INK, fontsize=12)
    fig.tight_layout()
    return fig
