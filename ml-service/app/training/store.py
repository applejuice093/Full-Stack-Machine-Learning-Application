from __future__ import annotations

import json
from uuid import uuid4

import pandas as pd

from app.core.storage import DATA_DIR, fetch, is_valid_id, persist

def save_table(headers: list[str], rows: list[list[str]], filename: str) -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    dataset_id = uuid4().hex
    frame = pd.DataFrame(rows, columns=headers)
    table_path = DATA_DIR / f"{dataset_id}.parquet"
    meta_path = DATA_DIR / f"{dataset_id}.json"
    frame.to_parquet(table_path, index=False)
    meta_path.write_text(
        json.dumps({"filename": filename, "headers": headers}),
        encoding="utf-8",
    )
    persist(table_path)
    persist(meta_path)
    return dataset_id


def load_table(dataset_id: str) -> pd.DataFrame:
    if not is_valid_id(dataset_id):
        raise FileNotFoundError("Unknown dataset.")
    path = DATA_DIR / f"{dataset_id}.parquet"
    if not fetch(path):
        raise FileNotFoundError("That dataset is no longer stored. Upload it again.")
    return pd.read_parquet(path)
