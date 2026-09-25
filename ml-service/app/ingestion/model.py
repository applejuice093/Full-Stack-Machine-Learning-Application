from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

import pandas as pd

PREVIEW_ROWS = 2000
_INT = re.compile(r"-?\d+")
_FLOAT = re.compile(r"-?\d+(\.\d+)?([eE][+-]?\d+)?")
_DATETIME = re.compile(r"\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?")


@dataclass
class ColumnSchema:
    name: str
    inferred_type: str
    missing_count: int
    unique_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "inferredType": self.inferred_type,
            "missingCount": self.missing_count,
            "uniqueCount": self.unique_count,
        }


@dataclass
class NormalizedDataset:
    filename: str
    original_filename: str
    source_format: str
    headers: list[str]
    rows: list[list[str]]
    all_rows: list[list[str]]
    row_count: int
    column_count: int
    schema: list[ColumnSchema]
    missing_values: int
    target_column: str | None = None
    output_format: str = "csv"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "originalFilename": self.original_filename,
            "sourceFormat": self.source_format,
            "outputFormat": self.output_format,
            "headers": self.headers,
            "rows": self.rows,
            "rowCount": self.row_count,
            "columnCount": self.column_count,
            "schema": [column.to_dict() for column in self.schema],
            "missingValues": self.missing_values,
            "targetColumn": self.target_column,
            "metadata": self.metadata,
        }


def cell_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    try:
        if pd.isna(value):
            return ""
    except TypeError:
        pass
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    text = str(value).strip()
    if text.lower() in {"nan", "nat", "none", "<na>"}:
        return ""
    return text


def from_records(
    records: list[dict[str, Any]],
    headers: list[str],
    *,
    filename: str,
    source_format: str,
    target_column: str | None = None,
    declared_types: dict[str, str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> NormalizedDataset:
    if not headers:
        raise ValueError("The table has no columns.")
    full_rows = [[cell_to_text(record.get(header)) for header in headers] for record in records]
    return _from_string_rows(
        headers,
        full_rows,
        filename=filename,
        source_format=source_format,
        target_column=target_column,
        declared_types=declared_types,
        metadata=metadata,
    )


def from_dataframe(
    frame: pd.DataFrame,
    *,
    filename: str,
    source_format: str,
    target_column: str | None = None,
    declared_types: dict[str, str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> NormalizedDataset:
    working = frame.copy()
    working.columns = [_unique_name(str(name), index) for index, name in enumerate(working.columns)]
    headers = [str(column) for column in working.columns]
    records = working.to_dict(orient="records")
    return from_records(
        records,
        headers,
        filename=filename,
        source_format=source_format,
        target_column=target_column,
        declared_types=declared_types,
        metadata=metadata,
    )


def _from_string_rows(
    headers: list[str],
    full_rows: list[list[str]],
    *,
    filename: str,
    source_format: str,
    target_column: str | None,
    declared_types: dict[str, str] | None,
    metadata: dict[str, Any] | None,
) -> NormalizedDataset:
    schema: list[ColumnSchema] = []
    missing_total = 0
    declared = declared_types or {}
    for index, header in enumerate(headers):
        column = [row[index] if index < len(row) else "" for row in full_rows]
        inferred, missing, unique = infer_column(column)
        if header in declared:
            inferred = declared[header]
        missing_total += missing
        schema.append(
            ColumnSchema(
                name=header,
                inferred_type=inferred,
                missing_count=missing,
                unique_count=unique,
            )
        )
    if not full_rows:
        raise ValueError("The file needs a header and at least one data row.")
    return NormalizedDataset(
        filename=filename,
        original_filename=filename,
        source_format=source_format,
        headers=headers,
        rows=full_rows[:PREVIEW_ROWS],
        all_rows=full_rows,
        row_count=len(full_rows),
        column_count=len(headers),
        schema=schema,
        missing_values=missing_total,
        target_column=target_column if target_column in headers else None,
        metadata=metadata or {},
    )


def infer_column(values: list[str]) -> tuple[str, int, int]:
    present = [value for value in values if value != ""]
    missing = len(values) - len(present)
    unique = len(set(present))
    if not present:
        return "string", missing, unique
    lowered = [value.lower() for value in present]
    if all(value in {"true", "false", "yes", "no"} for value in lowered):
        return "boolean", missing, unique
    if all(_INT.fullmatch(value) for value in present):
        return "integer", missing, unique
    if all(_FLOAT.fullmatch(value) for value in present):
        return "float", missing, unique
    if all(_DATETIME.fullmatch(value) for value in present):
        return "datetime", missing, unique
    if unique <= 24 and unique / max(len(present), 1) <= 0.5:
        return "categorical", missing, unique
    return "string", missing, unique


def _unique_name(name: str, index: int) -> str:
    cleaned = name.strip() or f"column_{index + 1}"
    return cleaned
