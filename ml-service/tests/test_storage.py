"""Blob mirroring: a file written by one instance can be read by another."""

import vercel.blob

from app.core import storage
from app.training.store import load_table, save_table


class _FakeBlob:
    objects: dict[str, bytes] = {}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def put(self, key, body, **_kwargs):
        self.objects[key] = bytes(body)

    def get(self, key, **_kwargs):
        if key not in self.objects:
            raise vercel.blob.BlobNotFoundError()
        return type("Result", (), {"content": self.objects[key]})()


def test_dataset_survives_losing_local_copy(monkeypatch) -> None:
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "test-token")
    monkeypatch.setattr(vercel.blob, "BlobClient", _FakeBlob)
    dataset_id = save_table(["a", "b"], [["1", "2"], ["3", "4"]], "t.csv")
    assert f"ml-service/datasets/{dataset_id}.parquet" in _FakeBlob.objects

    (storage.DATA_DIR / f"{dataset_id}.parquet").unlink()  # simulate a fresh serverless instance
    frame = load_table(dataset_id)
    assert list(frame.columns) == ["a", "b"]
    assert len(frame) == 2


def test_missing_everywhere_is_reported(monkeypatch) -> None:
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "test-token")
    monkeypatch.setattr(vercel.blob, "BlobClient", _FakeBlob)
    assert storage.fetch(storage.DATA_DIR / ("0" * 32 + ".parquet")) is False
