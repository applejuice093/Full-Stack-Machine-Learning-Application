from __future__ import annotations

import csv
import io
import json
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import numpy as np
import pandas as pd
import yaml

from app.ingestion.errors import ParseError
from app.ingestion.model import NormalizedDataset, from_dataframe, from_records

MAX_BYTES = 8 * 1024 * 1024
MAX_OBSERVED_FEATURES = 2000

MULTIMEDIA = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".mp3",
    ".wav",
    ".flac",
    ".mp4",
    ".avi",
    ".mov",
}
UNSAFE = {".pkl", ".pickle", ".joblib"}
R_FORMATS = {".rds", ".rdata", ".rda"}

_LIBSVM_LINE = re.compile(r"^[^\s]+\s+(?:\d+:\S+\s*)+$")


def parse_bytes(raw: bytes, filename: str, member: str | None = None) -> NormalizedDataset:
    if not raw:
        raise ParseError("This file is empty.")
    if len(raw) > MAX_BYTES:
        raise ParseError("This file is larger than 8 MB. Use a smaller file.")

    extension = _extension(filename)
    if extension in UNSAFE:
        raise ParseError(
            "Python serialized model/data files are not accepted for security reasons. "
            "Export the dataset to CSV, Parquet, NumPy or another supported data format."
        )
    if extension in MULTIMEDIA:
        raise ParseError(
            "This is a multimedia file, not a tabular dataset. Bench currently requires structured/tabular data."
        )
    if extension in R_FORMATS:
        return _parse_r(raw, filename, extension)

    kind = _detect(raw, extension)
    parsers = {
        "delimited": lambda: _parse_delimited(raw, filename, extension),
        "excel": lambda: _parse_excel(raw, filename, extension, member),
        "arff": lambda: _parse_arff(raw, filename),
        "libsvm": lambda: _parse_libsvm(raw, filename),
        "npy": lambda: _parse_npy(raw, filename),
        "npz": lambda: _parse_npz(raw, filename, member),
        "parquet": lambda: _parse_parquet(raw, filename),
        "feather": lambda: _parse_feather(raw, filename),
        "arrow": lambda: _parse_arrow(raw, filename),
        "hdf5": lambda: _parse_hdf5(raw, filename, member),
        "matlab": lambda: _parse_matlab(raw, filename, member),
        "json": lambda: _parse_json(raw, filename),
        "jsonl": lambda: _parse_jsonl(raw, filename),
        "yaml": lambda: _parse_yaml(raw, filename),
        "xml": lambda: _parse_xml(raw, filename),
        "spss": lambda: _parse_stats(raw, filename, "sav"),
        "stata": lambda: _parse_stats(raw, filename, "dta"),
        "sas": lambda: _parse_stats(raw, filename, "sas7bdat"),
        "xpt": lambda: _parse_stats(raw, filename, "xpt"),
    }
    parser = parsers.get(kind)
    if parser is None:
        raise ParseError(f"{filename} is not a supported dataset format.")
    try:
        dataset = parser()
    except ParseError:
        raise
    except Exception as exc:
        raise ParseError(f"{filename} could not be read as {kind}: {exc}") from exc
    dataset.metadata.setdefault("detectedFormat", kind)
    return dataset


def _extension(filename: str) -> str:
    dot = filename.lower().rfind(".")
    return filename[dot:].lower() if dot >= 0 else ""


def _detect(raw: bytes, extension: str) -> str:
    if extension in {".pkl", ".pickle", ".joblib"}:
        return "unsafe"
    if raw.startswith(b"\x93NUMPY"):
        return "npy"
    if raw.startswith(b"PAR1"):
        return "parquet"
    if raw.startswith(b"\x89HDF\r\n\x1a\n"):
        if extension == ".mat":
            return "matlab"
        return "hdf5"
    if raw.startswith(b"MATLAB"):
        return "matlab"
    if raw.startswith(b"ARROW1"):
        return "arrow"
    if raw.startswith(b"PK\x03\x04"):
        return _detect_zip(raw, extension)
    by_extension = {
        ".csv": "delimited",
        ".tsv": "delimited",
        ".txt": "delimited",
        ".dat": "delimited",
        ".xlsx": "excel",
        ".xls": "excel",
        ".xlsm": "excel",
        ".arff": "arff",
        ".libsvm": "libsvm",
        ".svm": "libsvm",
        ".npy": "npy",
        ".npz": "npz",
        ".parquet": "parquet",
        ".feather": "feather",
        ".arrow": "arrow",
        ".h5": "hdf5",
        ".hdf5": "hdf5",
        ".mat": "matlab",
        ".json": "json",
        ".jsonl": "jsonl",
        ".ndjson": "jsonl",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".xml": "xml",
        ".sav": "spss",
        ".dta": "stata",
        ".sas7bdat": "sas",
        ".xpt": "xpt",
    }
    if extension == ".dat" and _looks_like_libsvm(raw):
        return "libsvm"
    if extension in by_extension:
        return by_extension[extension]
    sample = raw[:4000].decode("utf-8", errors="ignore").lstrip()
    if sample.upper().startswith("@RELATION") or "@ATTRIBUTE" in sample.upper():
        return "arff"
    if _looks_like_libsvm(raw):
        return "libsvm"
    if sample.startswith("{") or sample.startswith("["):
        return "json"
    if "," in sample or "\t" in sample or ";" in sample or "|" in sample:
        return "delimited"
    raise ParseError("The file format could not be recognized as tabular data.")


def _detect_zip(raw: bytes, extension: str) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = archive.namelist()
    except zipfile.BadZipFile as exc:
        raise ParseError("This archive could not be opened.") from exc
    if any(name.endswith(".npy") for name in names):
        return "npz"
    if any(name.startswith("xl/") for name in names):
        return "excel"
    if extension in {".feather", ".arrow"}:
        return "feather"
    if extension == ".npz":
        return "npz"
    if extension in {".xlsx", ".xlsm", ".xls"}:
        return "excel"
    raise ParseError("This zip archive is not an Excel workbook or a NumPy archive.")


def _looks_like_libsvm(raw: bytes) -> bool:
    text = raw.decode("utf-8", errors="ignore")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if not lines:
        return False
    sample = lines[:8]
    return all(_LIBSVM_LINE.match(line) for line in sample)


def _decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ParseError("The text encoding is not supported. Save the file as UTF-8.")


def _sniff_delimiter(text: str, extension: str) -> str:
    if extension == ".tsv":
        return "\t"
    sample = "\n".join(text.splitlines()[:30])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        return dialect.delimiter
    except csv.Error:
        counts = {delimiter: sample.count(delimiter) for delimiter in [",", "\t", ";", "|"]}
        best = max(counts, key=counts.get)
        if counts[best] == 0:
            raise ParseError("No delimiter (comma, tab, semicolon, or pipe) was found.")
        return best


def _parse_delimited(raw: bytes, filename: str, extension: str) -> NormalizedDataset:
    text = _decode(raw)
    if extension == ".dat" and _looks_like_libsvm(raw):
        return _parse_libsvm(raw, filename)
    delimiter = _sniff_delimiter(text, extension)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    table = [row for row in reader if any(cell.strip() for cell in row)]
    if len(table) < 2:
        raise ParseError("The file needs a header row and at least one data row.")
    headers = [cell.strip() for cell in table[0]]
    if any(header == "" for header in headers):
        raise ParseError("Every column needs a name in the first row.")
    headers = _dedupe(headers)
    width = len(headers)
    records = []
    for row in table[1:]:
        padded = list(row) + [""] * (width - len(row))
        records.append({headers[index]: padded[index].strip() for index in range(width)})
    return from_records(records, headers, filename=filename, source_format="delimited")


def _parse_excel(raw: bytes, filename: str, extension: str, member: str | None) -> NormalizedDataset:
    if extension == ".xls" or raw.startswith(b"\xd0\xcf\x11\xe0"):
        return _parse_xls(raw, filename, member)
    buffer = io.BytesIO(raw)
    try:
        book = pd.ExcelFile(buffer, engine="openpyxl")
    except Exception as exc:
        raise ParseError(f"The workbook could not be opened: {exc}") from exc
    non_empty: list[str] = []
    frames: dict[str, pd.DataFrame] = {}
    for sheet in book.sheet_names:
        frame = book.parse(sheet)
        if frame.dropna(how="all").empty:
            continue
        non_empty.append(sheet)
        frames[sheet] = frame
    if not non_empty:
        raise ParseError("The workbook has no non-empty sheets.")
    chosen = member if member in frames else non_empty[0]
    dataset = from_dataframe(frames[chosen], filename=filename, source_format="excel")
    dataset.metadata.update({"sheets": non_empty, "selectedMember": chosen, "candidates": non_empty})
    return dataset


def _parse_xls(raw: bytes, filename: str, member: str | None) -> NormalizedDataset:
    try:
        book = pd.ExcelFile(io.BytesIO(raw), engine="xlrd")
    except ImportError as exc:
        raise ParseError("Reading .xls needs the xlrd package.") from exc
    except Exception as exc:
        raise ParseError(f"The .xls workbook could not be opened: {exc}") from exc
    names = []
    frames = {}
    for sheet in book.sheet_names:
        frame = book.parse(sheet)
        if frame.dropna(how="all").empty:
            continue
        names.append(sheet)
        frames[sheet] = frame
    if not names:
        raise ParseError("The workbook has no non-empty sheets.")
    chosen = member if member in frames else names[0]
    dataset = from_dataframe(frames[chosen], filename=filename, source_format="excel")
    dataset.metadata.update({"sheets": names, "selectedMember": chosen, "candidates": names})
    return dataset


def _parse_arff(raw: bytes, filename: str) -> NormalizedDataset:
    text = _decode(raw)
    relation = filename
    attributes: list[tuple[str, str, list[str] | None]] = []
    data_lines: list[str] = []
    in_data = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("%"):
            continue
        upper = line.upper()
        if not in_data and upper.startswith("@RELATION"):
            relation = line.split(None, 1)[1].strip().strip("'\"")
        elif not in_data and upper.startswith("@ATTRIBUTE"):
            attributes.append(_parse_attribute(line))
        elif upper.startswith("@DATA"):
            in_data = True
        elif in_data:
            data_lines.append(line)
    if not attributes or not data_lines:
        raise ParseError("The ARFF file needs @ATTRIBUTE definitions and an @DATA section.")
    headers = [name for name, _, _ in attributes]
    declared: dict[str, str] = {}
    nominals: dict[str, list[str]] = {}
    for name, kind, values in attributes:
        declared[name] = kind
        if values is not None:
            nominals[name] = values
    records = []
    for line in data_lines:
        if line.startswith("{") and line.endswith("}"):
            records.append(_sparse_arff_row(line, headers))
        else:
            cells = next(csv.reader([line]))
            cells = [cell.strip() for cell in cells]
            if len(cells) < len(headers):
                cells.extend([""] * (len(headers) - len(cells)))
            record = {}
            for index, header in enumerate(headers):
                value = cells[index]
                record[header] = "" if value == "?" else value
            records.append(record)
    target = _arff_target(attributes)
    return from_records(
        records,
        headers,
        filename=filename,
        source_format="arff",
        target_column=target,
        declared_types=declared,
        metadata={"relation": relation, "nominalValues": nominals},
    )


def _parse_attribute(line: str) -> tuple[str, str, list[str] | None]:
    body = line.split(None, 1)[1].strip()
    if body.startswith("'") or body.startswith('"'):
        quote = body[0]
        end = body.find(quote, 1)
        name = body[1:end]
        rest = body[end + 1 :].strip()
    else:
        parts = body.split(None, 1)
        name = parts[0]
        rest = parts[1].strip() if len(parts) > 1 else "string"
    upper = rest.upper()
    if upper in {"NUMERIC", "REAL", "INTEGER"}:
        kind = "integer" if upper == "INTEGER" else "float"
        return name, kind, None
    if upper == "STRING":
        return name, "string", None
    if upper.startswith("DATE"):
        return name, "datetime", None
    if rest.startswith("{") and rest.endswith("}"):
        values = [item.strip().strip("'\"") for item in next(csv.reader([rest[1:-1]]))]
        return name, "categorical", values
    if upper.startswith("RELATIONAL"):
        return name, "string", None
    return name, "string", None


def _sparse_arff_row(line: str, headers: list[str]) -> dict[str, str]:
    record = {header: "" for header in headers}
    inner = line[1:-1].strip()
    if not inner:
        return record
    for piece in inner.split(","):
        index_text, _, value = piece.strip().partition(" ")
        index = int(index_text)
        if 0 <= index < len(headers):
            record[headers[index]] = "" if value.strip() == "?" else value.strip()
    return record


def _arff_target(attributes: list[tuple[str, str, list[str] | None]]) -> str | None:
    for name, _, _ in attributes:
        if name.lower() == "class":
            return name
    for name, kind, _ in reversed(attributes):
        if kind == "categorical":
            return name
    return None


def _parse_libsvm(raw: bytes, filename: str) -> NormalizedDataset:
    text = _decode(raw)
    parsed: list[tuple[str, dict[int, str]]] = []
    observed: set[int] = set()
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = stripped.split()
        label = parts[0]
        features: dict[int, str] = {}
        for token in parts[1:]:
            index_text, separator, value = token.partition(":")
            if not separator:
                raise ParseError("A LIBSVM row has a feature that is not index:value.")
            index = int(index_text)
            if index < 1:
                raise ParseError("LIBSVM feature indexes start at 1.")
            features[index] = value
            observed.add(index)
        parsed.append((label, features))
    if not parsed:
        raise ParseError("The LIBSVM file has no rows.")
    if len(observed) > MAX_OBSERVED_FEATURES:
        raise ParseError(
            f"This sparse dataset has {len(observed)} observed features. "
            "Bench keeps sparse files dense only up to "
            f"{MAX_OBSERVED_FEATURES} columns."
        )
    indexes = sorted(observed)
    headers = ["label", *[f"f{index}" for index in indexes]]
    records = []
    for label, features in parsed:
        record = {"label": label}
        for index in indexes:
            record[f"f{index}"] = features.get(index, "")
        records.append(record)
    declared = {f"f{index}": "float" for index in indexes}
    declared["label"] = "categorical"
    return from_records(
        records,
        headers,
        filename=filename,
        source_format="libsvm",
        target_column="label",
        declared_types=declared,
        metadata={"sparse": True, "observedFeatures": len(indexes), "maxIndex": max(indexes, default=0)},
    )


def _array_to_frame(array: np.ndarray, filename: str) -> pd.DataFrame:
    if array.ndim == 1:
        return pd.DataFrame({"value": array})
    if array.ndim == 2:
        columns = [f"f{index + 1}" for index in range(array.shape[1])]
        return pd.DataFrame(array, columns=columns)
    raise ParseError(
        "This file contains a multi-dimensional array and cannot be represented as a simple table without reshaping."
    )


def _parse_npy(raw: bytes, filename: str) -> NormalizedDataset:
    try:
        array = np.load(io.BytesIO(raw), allow_pickle=False)
    except ValueError as exc:
        raise ParseError("NumPy object arrays are not accepted.") from exc
    frame = _array_to_frame(np.asarray(array), filename)
    return from_dataframe(frame, filename=filename, source_format="npy")


def _parse_npz(raw: bytes, filename: str, member: str | None) -> NormalizedDataset:
    try:
        archive = np.load(io.BytesIO(raw), allow_pickle=False)
    except ValueError as exc:
        raise ParseError("NumPy object arrays are not accepted.") from exc
    compatible: list[str] = []
    for name in archive.files:
        array = np.asarray(archive[name])
        if array.ndim in {1, 2}:
            compatible.append(name)
    if not compatible:
        raise ParseError("The .npz archive has no 1D or 2D arrays that can be shown as a table.")
    chosen = member if member in compatible else compatible[0]
    frame = _array_to_frame(np.asarray(archive[chosen]), filename)
    dataset = from_dataframe(frame, filename=filename, source_format="npz")
    dataset.metadata.update({"candidates": compatible, "selectedMember": chosen})
    return dataset


def _parse_parquet(raw: bytes, filename: str) -> NormalizedDataset:
    frame = pd.read_parquet(io.BytesIO(raw))
    return from_dataframe(frame, filename=filename, source_format="parquet")


def _parse_feather(raw: bytes, filename: str) -> NormalizedDataset:
    frame = pd.read_feather(io.BytesIO(raw))
    return from_dataframe(frame, filename=filename, source_format="feather")


def _parse_arrow(raw: bytes, filename: str) -> NormalizedDataset:
    import pyarrow.ipc as ipc

    reader = ipc.open_file(io.BytesIO(raw))
    table = reader.read_all()
    return from_dataframe(table.to_pandas(), filename=filename, source_format="arrow")


def _hdf_candidates(group: Any, prefix: str, found: list[str]) -> None:
    import h5py

    for key, item in group.items():
        path = f"{prefix}/{key}" if prefix else str(key)
        if isinstance(item, h5py.Dataset) and item.ndim in {1, 2}:
            found.append(path)
        elif isinstance(item, h5py.Group):
            _hdf_candidates(item, path, found)


def _parse_hdf5(raw: bytes, filename: str, member: str | None) -> NormalizedDataset:
    import h5py

    with h5py.File(io.BytesIO(raw), "r") as handle:
        candidates: list[str] = []
        _hdf_candidates(handle, "", candidates)
        if not candidates:
            raise ParseError("No 1D or 2D datasets were found in this HDF5 file.")
        chosen = member if member in candidates else candidates[0]
        array = np.asarray(handle[chosen])
    frame = _array_to_frame(array, filename)
    dataset = from_dataframe(frame, filename=filename, source_format="hdf5")
    dataset.metadata.update({"candidates": candidates, "selectedMember": chosen})
    return dataset


def _parse_matlab(raw: bytes, filename: str, member: str | None) -> NormalizedDataset:
    if raw.startswith(b"\x89HDF"):
        return _parse_hdf5(raw, filename, member)
    from scipy.io import loadmat

    payload = loadmat(io.BytesIO(raw), squeeze_me=False, struct_as_record=True)
    candidates: list[str] = []
    arrays: dict[str, np.ndarray] = {}
    for name, value in payload.items():
        if name.startswith("__"):
            continue
        array = np.asarray(value)
        if array.dtype == object:
            continue
        if array.ndim in {1, 2} and array.size > 0:
            candidates.append(name)
            arrays[name] = array
    if not candidates:
        raise ParseError("No matrix or vector variables were found in this MAT file.")
    chosen = member if member in arrays else candidates[0]
    frame = _array_to_frame(arrays[chosen], filename)
    dataset = from_dataframe(frame, filename=filename, source_format="matlab")
    dataset.metadata.update({"candidates": candidates, "selectedMember": chosen})
    return dataset


def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        flat: dict[str, Any] = {}
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(item, dict):
                flat.update(_flatten(item, path))
            elif isinstance(item, list):
                flat[path] = json.dumps(item, ensure_ascii=False)
            else:
                flat[path] = item
        return flat
    return {prefix or "value": value}


def _records_from_objects(items: list[Any]) -> tuple[list[str], list[dict[str, Any]]]:
    if not items or not all(isinstance(item, dict) for item in items):
        raise ParseError("The file is not an array of objects that can become a table.")
    flat_rows = [_flatten(item) for item in items]
    headers: list[str] = []
    for row in flat_rows:
        for key in row:
            if key not in headers:
                headers.append(key)
    return headers, flat_rows


def _parse_json(raw: bytes, filename: str) -> NormalizedDataset:
    try:
        payload = json.loads(_decode(raw))
    except json.JSONDecodeError as exc:
        raise ParseError(f"The JSON could not be parsed: {exc}") from exc
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        payload = payload["data"]
    if not isinstance(payload, list):
        raise ParseError("JSON tables must be an array of objects.")
    headers, records = _records_from_objects(payload)
    return from_records(records, headers, filename=filename, source_format="json")


def _parse_jsonl(raw: bytes, filename: str) -> NormalizedDataset:
    items = []
    for line_number, line in enumerate(_decode(raw).splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            item = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ParseError(f"Line {line_number} is not a JSON object.") from exc
        if not isinstance(item, dict):
            raise ParseError(f"Line {line_number} is not a JSON object.")
        items.append(item)
    headers, records = _records_from_objects(items)
    return from_records(records, headers, filename=filename, source_format="jsonl")


def _parse_yaml(raw: bytes, filename: str) -> NormalizedDataset:
    payload = yaml.safe_load(io.BytesIO(raw))
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        payload = payload["data"]
    if not isinstance(payload, list):
        raise ParseError("This YAML file cannot be converted into a table. Use a list of objects.")
    headers, records = _records_from_objects(payload)
    return from_records(records, headers, filename=filename, source_format="yaml")


def _parse_xml(raw: bytes, filename: str) -> NormalizedDataset:
    try:
        root = ElementTree.fromstring(raw)
    except ElementTree.ParseError as exc:
        raise ParseError(f"The XML could not be parsed: {exc}") from exc
    children = list(root)
    if len(children) < 1:
        raise ParseError("This XML file has no repeating records to turn into rows.")
    tags = {child.tag for child in children}
    if len(tags) != 1:
        raise ParseError("This XML file cannot be converted into a table. Rows need the same element name.")
    items = []
    for child in children:
        if list(child):
            record = {}
            for field in child:
                record[field.tag] = field.text or ""
            items.append(record)
        elif child.attrib:
            items.append(dict(child.attrib))
        else:
            raise ParseError("This XML file cannot be converted into a table.")
    headers, records = _records_from_objects(items)
    return from_records(records, headers, filename=filename, source_format="xml")


def _parse_stats(raw: bytes, filename: str, kind: str) -> NormalizedDataset:
    try:
        import pyreadstat
    except ImportError as exc:
        raise ParseError(
            f"Reading {kind} files needs the optional pyreadstat package. "
            "Install it in the ML service environment."
        ) from exc
    readers = {
        "sav": pyreadstat.read_sav,
        "dta": pyreadstat.read_dta,
        "sas7bdat": pyreadstat.read_sas7bdat,
        "xpt": pyreadstat.read_xport,
    }
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / filename
        path.write_bytes(raw)
        frame, _meta = readers[kind](str(path))
    return from_dataframe(frame, filename=filename, source_format=kind)


def _parse_r(raw: bytes, filename: str, extension: str) -> NormalizedDataset:
    try:
        import pyreadr
    except ImportError as exc:
        raise ParseError("R serialization format is not currently supported in this environment.") from exc
    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as handle:
            handle.write(raw)
            temp_path = handle.name
        result = pyreadr.read_r(temp_path)
        Path(temp_path).unlink(missing_ok=True)
    except ParseError:
        raise
    except Exception as exc:
        raise ParseError("R serialization format is not currently supported in this environment.") from exc
    frames = {name: value for name, value in result.items() if isinstance(value, pd.DataFrame)}
    if not frames:
        raise ParseError("R serialization format is not currently supported in this environment.")
    name = next(iter(frames))
    dataset = from_dataframe(frames[name], filename=filename, source_format=extension.lstrip("."))
    dataset.metadata.update({"candidates": list(frames), "selectedMember": name})
    return dataset


def _dedupe(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    result = []
    for header in headers:
        count = seen.get(header, 0) + 1
        seen[header] = count
        result.append(header if count == 1 else f"{header}_{count}")
    return result
