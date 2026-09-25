from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from app.ingestion.errors import ParseError
from app.training.store import load_table, save_table
from app.training.train import TrainError, predict_row, train_dataset
from app.visualization.plots import dataset_figures, load_evaluation_figures

router = APIRouter()


class StoreBody(BaseModel):
    filename: str
    headers: list[str]
    rows: list[list[str]]


class PredictBody(BaseModel):
    runId: str
    values: dict[str, str | int | float]


class TrainBody(BaseModel):
    datasetId: str
    target: str
    features: list[str]
    task: str
    modelId: str
    search: str | None = None
    testSize: float = Field(default=0.2, gt=0.05, lt=0.5)
    seed: int = 42
    paramGrid: dict | None = None
    numericImpute: str = "median"
    categoricalImpute: str = "most_frequent"
    scale: bool = True
    dropDuplicates: bool = True


@router.post("/datasets/store")
def store_dataset(body: StoreBody) -> dict:
    if not body.headers or not body.rows:
        raise HTTPException(status_code=400, detail="The table is empty.")
    try:
        dataset_id = save_table(body.headers, body.rows, body.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"datasetId": dataset_id}


class DatasetFigureBody(BaseModel):
    datasetId: str


@router.post("/visualize/dataset")
def visualize_dataset(body: DatasetFigureBody) -> dict:
    try:
        frame = load_table(body.datasetId)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return dataset_figures(frame)


@router.get("/visualize/evaluation/{run_id}")
def visualize_evaluation(run_id: str) -> dict:
    try:
        images = load_evaluation_figures(run_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"images": images}


@router.post("/predict")
def predict(body: PredictBody) -> dict:
    try:
        return predict_row(body.runId, {key: str(value) for key, value in body.values.items()})
    except (TrainError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/train")
def train(body: TrainBody) -> dict:
    try:
        return train_dataset(
            body.datasetId,
            features=body.features,
            target=body.target,
            task=body.task,
            model_id=body.modelId,
            search=body.search,
            test_size=body.testSize,
            seed=body.seed,
            param_grid=body.paramGrid,
            numeric_impute=body.numericImpute,
            categorical_impute=body.categoricalImpute,
            scale=body.scale,
            drop_duplicates=body.dropDuplicates,
        )
    except (TrainError, ParseError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
