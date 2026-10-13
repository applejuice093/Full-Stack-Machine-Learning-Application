# API route index

Authoritative field-level docs live in [API and user flow](../api-and-flow.md). This page is a quick index of what each process exposes.

## Express (`backend/`, default `http://localhost:4000`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, service, version, uptimeSeconds }` |
| POST | `/datasets/parse` | multipart `file` (+ optional `member`); forwards to ML |
| POST | `/datasets/store` | JSON table; zod-validated; forwards to ML |
| POST | `/train` | JSON train request; zod-validated; forwards to ML |
| POST | `/predict` | JSON `{ runId, values }`; zod-validated; forwards to ML |
| POST | `/visualize/dataset` | JSON `{ datasetId }` → chart payloads |
| GET | `/visualize/evaluation/:runId` | evaluation chart images |

Errors: `{ "detail": "..." }`. `400` = bad input; `413` = upload too large; `503` = ML unreachable; `404` = unknown route.

## ML service (`ml-service/`, default `http://localhost:8000`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, service, version, uptimeSeconds }` |
| POST | `/dataset/parse` | multipart parse + persist Parquet |
| POST | `/datasets/store` | JSON rows → Parquet + `datasetId` |
| POST | `/train` | fit / search / evaluate / save joblib |
| POST | `/predict` | score one row with a saved run |
| POST | `/visualize/dataset` | feature / correlation / missingness figures |
| GET | `/visualize/evaluation/{run_id}` | saved evaluation figures |

Pydantic models in `ml-service/app/api/train.py` define the train/store/predict bodies. Express zod schemas in `backend/src/validators/datasets.ts` mirror the same shapes for early rejection.

## Auth

No authentication is enforced on these routes yet. `AUTH_SECRET` and related packages are reserved for a future session module.
