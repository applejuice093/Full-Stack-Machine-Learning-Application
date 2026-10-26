# API route index

Authoritative field-level docs live in [API and user flow](../api-and-flow.md). This page is a quick index of what each process exposes.

## Express (`backend/`, default `http://localhost:4000`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, service, version, uptimeSeconds }` |
| POST | `/datasets/parse` | multipart `file` (+ optional `member`); forwards to ML |
| POST | `/datasets/store` | JSON table; zod-validated (unique, non-blank headers; every row as wide as the headers); forwards to ML |
| POST | `/train` | JSON train request; zod-validated; forwards to ML |
| POST | `/predict` | JSON `{ runId, values }`; zod-validated; forwards to ML |
| POST | `/visualize/dataset` | JSON `{ datasetId }`; zod-validated → chart payloads |
| GET | `/visualize/evaluation/:runId` | evaluation chart images; `runId` must be a 32-char hex id |

Errors: `{ "detail": "..." }`.

| Status | Meaning |
|---|---|
| `400` | Bad input, including malformed JSON and ids that were not issued by the ML service |
| `404` | Unknown route |
| `413` | Upload or JSON body larger than 4 MB |
| `502` | The ML service answered with something that is not JSON |
| `503` | The ML service could not be reached |
| `504` | The ML service did not answer within `ML_TIMEOUT_MS` |

`datasetId` and `runId` are always `uuid4().hex` strings (32 lowercase hex characters). Both Express and the ML service reject anything else before touching storage. In production, unexpected 5xx errors return a generic message; details go to the server log.

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
