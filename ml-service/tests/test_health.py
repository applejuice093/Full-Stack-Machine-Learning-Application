from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ml-service"
    assert isinstance(body["version"], str)
    assert isinstance(body["uptimeSeconds"], (int, float))
    assert body["uptimeSeconds"] >= 0
