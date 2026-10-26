from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_store_rejects_ragged_rows():
    response = client.post(
        "/datasets/store",
        json={"filename": "x.csv", "headers": ["a", "b"], "rows": [["1", "2"], ["3"]]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Row 2 has 1 values but there are 2 columns."


def test_store_rejects_duplicate_and_blank_headers():
    duplicate = client.post(
        "/datasets/store",
        json={"filename": "x.csv", "headers": ["a", "a"], "rows": [["1", "2"]]},
    )
    blank = client.post(
        "/datasets/store",
        json={"filename": "x.csv", "headers": ["a", " "], "rows": [["1", "2"]]},
    )
    assert duplicate.status_code == 400
    assert "unique" in duplicate.json()["detail"]
    assert blank.status_code == 400
    assert "blank" in blank.json()["detail"]


def test_store_accepts_a_valid_table(tmp_path, monkeypatch):
    import app.training.store as store

    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    response = client.post(
        "/datasets/store",
        json={"filename": "x.csv", "headers": ["a", "b"], "rows": [["1", "2"], ["3", "4"]]},
    )
    assert response.status_code == 200
    assert len(response.json()["datasetId"]) == 32
