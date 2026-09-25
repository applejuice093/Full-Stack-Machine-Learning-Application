import io
import json

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from scipy.io import savemat

from app.ingestion.errors import ParseError
from app.ingestion.parse import parse_bytes
from app.main import app

client = TestClient(app)


def test_csv_tsv_txt_and_dat() -> None:
    csv_data = parse_bytes(b"age,income\n20,50000\n25,65000\n", "people.csv")
    assert csv_data.headers == ["age", "income"]
    assert csv_data.rows[0] == ["20", "50000"]
    assert csv_data.schema[0].inferred_type == "integer"

    tsv = parse_bytes(b"age\tincome\n20\t50000\n", "people.tsv")
    assert tsv.headers == ["age", "income"]

    semi = parse_bytes(b"age;income\n20;50000\n", "people.txt")
    assert semi.rows[0][1] == "50000"

    pipe = parse_bytes(b"age|income\n20|50000\n", "notes.dat")
    assert pipe.column_count == 2


def test_quoted_csv_and_rejection() -> None:
    parsed = parse_bytes(b'name,note\n"Ada","a, b"\n', "quoted.csv")
    assert parsed.rows[0] == ["Ada", "a, b"]
    with pytest.raises(ParseError):
        parse_bytes(b"this is not a table", "broken.csv")


def test_excel_roundtrip() -> None:
    frame = pd.DataFrame({"age": [20, None], "city": ["north", "east"]})
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        frame.to_excel(writer, sheet_name="people", index=False)
        pd.DataFrame({"unused": [1]}).to_excel(writer, sheet_name="emptyish", index=False)
    parsed = parse_bytes(buffer.getvalue(), "people.xlsx")
    assert parsed.headers == ["age", "city"]
    assert parsed.rows[1][0] == ""
    assert "people" in parsed.metadata["candidates"]


def test_arff_keeps_schema_and_class() -> None:
    raw = """@RELATION iris
@ATTRIBUTE sepallength NUMERIC
@ATTRIBUTE sepalwidth NUMERIC
@ATTRIBUTE petallength NUMERIC
@ATTRIBUTE petalwidth NUMERIC
@ATTRIBUTE class {Iris-setosa,Iris-versicolor,Iris-virginica}
@DATA
5.1,3.5,1.4,0.2,Iris-setosa
""".encode()
    parsed = parse_bytes(raw, "iris.arff")
    assert parsed.metadata["relation"] == "iris"
    assert parsed.target_column == "class"
    assert parsed.headers[-1] == "class"
    assert parsed.rows[0][-1] == "Iris-setosa"
    assert parsed.schema[-1].inferred_type == "categorical"
    assert "Iris-setosa" in parsed.metadata["nominalValues"]["class"]


def test_libsvm_stays_sparse() -> None:
    raw = b"1 1:0.5 2:1.2 5:3.4\n0 2:0.1\n"
    parsed = parse_bytes(raw, "sample.libsvm")
    assert parsed.headers == ["label", "f1", "f2", "f5"]
    assert parsed.rows[0] == ["1", "0.5", "1.2", "3.4"]
    assert parsed.rows[1][1] == ""
    assert parsed.target_column == "label"
    assert parsed.metadata["maxIndex"] == 5


def test_numpy_npz_and_rejected_volume() -> None:
    buffer = io.BytesIO()
    np.save(buffer, np.array([[1.5, 2], [3, 4]]))
    parsed = parse_bytes(buffer.getvalue(), "matrix.npy")
    assert parsed.headers == ["f1", "f2"]
    assert parsed.rows[0][0] == "1.5"

    archive = io.BytesIO()
    np.savez(archive, train=np.array([[1, 2]]), extra=np.array([9, 8]))
    choices = parse_bytes(archive.getvalue(), "bundle.npz")
    assert set(choices.metadata["candidates"]) == {"train", "extra"}
    selected = parse_bytes(archive.getvalue(), "bundle.npz", member="extra")
    assert selected.metadata["selectedMember"] == "extra"
    assert selected.headers == ["value"]

    volume = io.BytesIO()
    np.save(volume, np.zeros((2, 2, 2)))
    with pytest.raises(ParseError, match="multi-dimensional array"):
        parse_bytes(volume.getvalue(), "volume.npy")


def test_parquet_feather_hdf5_and_matlab() -> None:
    frame = pd.DataFrame({"age": [20], "when": [pd.Timestamp("2020-01-02")]})
    parquet = io.BytesIO()
    frame.to_parquet(parquet, index=False)
    parsed = parse_bytes(parquet.getvalue(), "people.parquet")
    assert parsed.headers == ["age", "when"]
    assert parsed.rows[0][0] == "20"

    feather = io.BytesIO()
    frame.to_feather(feather)
    feather_parsed = parse_bytes(feather.getvalue(), "people.feather")
    assert feather_parsed.column_count == 2

    import h5py

    hdf = io.BytesIO()
    with h5py.File(hdf, "w") as handle:
        handle.create_dataset("train/features", data=np.array([[1.0, 2.0]]))
        handle.create_dataset("notes", data=np.array([3.0, 4.0]))
    hdf_parsed = parse_bytes(hdf.getvalue(), "study.h5", member="notes")
    assert hdf_parsed.metadata["selectedMember"] == "notes"
    assert "train/features" in hdf_parsed.metadata["candidates"]

    mat = io.BytesIO()
    savemat(mat, {"features": np.array([[1.0, 2.0]]), "label": np.array([[0.0], [1.0]])})
    mat_parsed = parse_bytes(mat.getvalue(), "study.mat")
    assert set(mat_parsed.metadata["candidates"]) == {"features", "label"}


def test_json_jsonl_yaml_and_xml() -> None:
    payload = [{"age": 20, "user": {"income": 50000}}, {"age": 25, "user": {"income": 65000}}]
    parsed = parse_bytes(json.dumps(payload).encode(), "people.json")
    assert parsed.headers == ["age", "user.income"]
    assert parsed.rows[1][1] == "65000"

    jsonl = b'{"age":20,"income":50000}\n{"age":25,"income":65000}\n'
    lines = parse_bytes(jsonl, "people.jsonl")
    assert lines.row_count == 2

    yaml_text = b"- age: 20\n  income: 50000\n- age: 25\n  income: 65000\n"
    yaml_parsed = parse_bytes(yaml_text, "people.yaml")
    assert yaml_parsed.headers == ["age", "income"]

    xml = b"<rows><row><age>20</age><income>50000</income></row></rows>"
    xml_parsed = parse_bytes(xml, "people.xml")
    assert xml_parsed.rows[0] == ["20", "50000"]
    with pytest.raises(ParseError):
        parse_bytes(b"<root><a>1</a><b>2</b></root>", "mixed.xml")


def test_security_and_multimedia_messages() -> None:
    with pytest.raises(ParseError, match="not accepted for security reasons"):
        parse_bytes(b"not really a pickle", "model.pkl")
    with pytest.raises(ParseError, match="multimedia file"):
        parse_bytes(b"\xff\xd8\xff", "photo.jpg")
    with pytest.raises(ParseError, match="R serialization format is not currently supported"):
        parse_bytes(b"not an r file", "model.rds")


def test_spss_and_arrow_roundtrip(tmp_path) -> None:
    import pyarrow as pa
    import pyarrow.ipc as ipc
    import pyreadstat

    frame = pd.DataFrame({"age": [20, 25], "city": ["north", "east"]})
    sav_path = tmp_path / "people.sav"
    pyreadstat.write_sav(frame, str(sav_path))
    parsed = parse_bytes(sav_path.read_bytes(), "people.sav")
    assert parsed.headers == ["age", "city"]
    assert parsed.row_count == 2

    dta_path = tmp_path / "people.dta"
    pyreadstat.write_dta(frame, str(dta_path))
    dta_parsed = parse_bytes(dta_path.read_bytes(), "people.dta")
    assert dta_parsed.rows[0][1] == "north"

    arrow_path = tmp_path / "people.arrow"
    table = pa.Table.from_pandas(frame)
    with pa.OSFile(str(arrow_path), "wb") as handle:
        with ipc.new_file(handle, table.schema) as writer:
            writer.write_table(table)
    arrow_parsed = parse_bytes(arrow_path.read_bytes(), "people.arrow")
    assert arrow_parsed.headers == ["age", "city"]


def test_http_parse_endpoint() -> None:
    response = client.post(
        "/dataset/parse",
        files={"file": ("houses.csv", b"rooms,price\n3,10\n", "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sourceFormat"] == "delimited"
    assert body["rowCount"] == 1
    assert body["schema"][0]["name"] == "rooms"
