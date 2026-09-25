from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.ingestion.errors import ParseError
from app.ingestion.parse import parse_bytes
from app.training.store import save_table

router = APIRouter()


@router.post("/dataset/parse")
async def parse_dataset(
    file: UploadFile = File(...),
    member: str | None = Form(default=None),
) -> dict:
    raw = await file.read()
    try:
        dataset = parse_bytes(raw, file.filename or "dataset", member or None)
    except ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = dataset.to_dict()
    payload["datasetId"] = save_table(dataset.headers, dataset.all_rows, dataset.filename)
    return payload
