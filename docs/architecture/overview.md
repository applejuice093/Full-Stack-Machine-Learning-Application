# Architecture overview

Bench is a three-process ML studio: a React SPA, an Express API, and a Python FastAPI ML service. PostgreSQL (with pgvector) is provisioned for future metadata; the live training path stores tables as Parquet and models as joblib files on disk (or Vercel Blob in production).

## Components

| Component | Path | Port (local) | Responsibility |
|---|---|---|---|
| Frontend | `frontend/` | 5173 | Upload UI, configure/train/evaluate/predict, charts |
| Express API | `backend/` | 4000 | CORS, upload size limits, zod validation, proxy to ML |
| ML service | `ml-service/` | 8000 | Parse, store, train, evaluate, visualize, predict |
| PostgreSQL | `docker-compose.yml` | 5432 | Schema in `database/schema/001_init.sql` (not yet wired to requests) |

## Request flow

```text
Browser
  |  Vite proxy (dev) or VITE_API_URL (prod)
  v
Express  --JSON / multipart-->  FastAPI
  |                               |
  |                               +--> ml-service/data/datasets/{id}.parquet
  |                               +--> models/{runId}.joblib (+ PNG charts)
  +--> (future) Postgres metadata
```

1. **Parse** — `POST /datasets/parse` (Express multipart) → `POST /dataset/parse` (ML). Returns schema, preview, and a `datasetId`.
2. **Store** — Browser-only CSV fallback posts rows to `POST /datasets/store` so training still has an id when Express was down during parse.
3. **Train** — `POST /train` with target, features, task, model, search, and prep flags. ML fits a sklearn pipeline, searches hyperparameters on train folds, scores the hold-out, saves the pipeline.
4. **Evaluate charts** — `GET /visualize/evaluation/:runId` returns base64 (or URL) images for metrics plots.
5. **Predict** — `POST /predict` with `runId` and a feature map; ML applies the same preprocessing.

## Boundaries

- The frontend never imports sklearn or pandas. It talks HTTP only.
- Express does not train models. It validates and forwards.
- The ML service does not own auth or sessions. CORS is configured via `CORS_ORIGINS`.
- Agents (LangGraph / Groq / Langfuse) are named in env and package.json but are not on the request path yet.

## Storage layout

| Artifact | Default location |
|---|---|
| Uploaded / stored tables | `ml-service/data/datasets/` (gitignored) |
| Trained pipelines + charts | `models/` (gitignored; `.gitkeep` kept) |
| Sample CSV for demos | `datasets/sample/houses.csv` |

Override root with `ML_STORAGE_DIR` (see `.env.example`).

## Related docs

- [Frontend and backend](../frontend-backend.md)
- [API and user flow](../api-and-flow.md)
- [ML pipeline](../ml-pipeline.md)
- [API route index](../api/README.md)
