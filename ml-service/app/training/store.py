from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "datasets"
_ID = re.compile(r"^[a-f0-9]{32}$")


def save_table(headers: list[str], rows: list[list[str]], filename: str) -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    dataset_id = uuid4().hex
    frame = pd.DataFrame(rows, columns=headers)
    frame.to_parquet(DATA_DIR / f"{dataset_id}.parquet", index=False)
    (DATA_DIR / f"{dataset_id}.json").write_text(
        json.dumps({"filename": filename, "headers": headers}),
        encoding="utf-8",
    )
    return dataset_id


def load_table(dataset_id: str) -> pd.DataFrame:
    if not _ID.fullmatch(dataset_id):
        raise FileNotFoundError("Unknown dataset.")
    path = DATA_DIR / f"{dataset_id}.parquet"
    if not path.exists():
        raise FileNotFoundError("That dataset is no longer stored. Upload it again.")
    return pd.read_parquet(path)
