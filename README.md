# End-to-End Machine Learning Web Application

Upload a CSV, inspect it, configure features and a target, train a scikit-learn model, evaluate it, and predict on new rows.

## Architecture

```text
React frontend
    |
    v
Node.js + Express API
    |                 \
    v                  v
PostgreSQL + pgvector  Python ML service
                           |
                           v
                    Pandas / NumPy / scikit-learn
```

The Express API owns authentication, uploads, metadata, and experiment status. The Python service owns preprocessing, training, evaluation, charts, and prediction. LangGraph runs agent explanations. It does not replace the training pipeline. Groq is the default LLM provider. Langfuse records agent and LLM traces.

## Features

The product workflow is upload, dataset analysis, feature and target selection, classification or regression, preprocessing, train/test split, hyperparameter search, evaluation, model save, and prediction.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Motion | Framer Motion, GSAP, Lottie, tsParticles |
| Backend | Node.js, Express |
| Database | PostgreSQL, pgvector |
| Agents | LangGraph |
| LLM | Groq |
| Observability | Langfuse |
| ML | Python, Pandas, NumPy, scikit-learn, Matplotlib, Seaborn |
| Deployment target | Vercel (frontend), Railway (API, ML service, PostgreSQL) |

Authentication is an Express session module. NextAuth is not used because this frontend is a Vite React app, not a Next.js app.

## Folder structure

```text
frontend/        React UI
backend/         Express API
ml-service/      Python training and prediction service
database/        SQL schema, migrations, seeds
shared/          Shared constants and types
docs/            Architecture, API, and project report
datasets/sample/ Sample CSV files
models/          Saved model artifacts (gitignored)
```

## Requirements

| Tool | Version |
|---|---|
| Node.js | 20 LTS or newer (24 recommended) |
| npm | 10 or newer |
| Python | 3.10–3.14 |
| Docker | Optional; used for local PostgreSQL via `docker compose` |

## Installation

Copy environment defaults first:

```bash
cp .env.example .env
```

### Windows (PowerShell)

```powershell
npm install --prefix frontend
npm install --prefix backend
py -3 -m venv ml-service\.venv
ml-service\.venv\Scripts\python -m pip install -r ml-service\requirements-dev.txt
Copy-Item .env.example .env
```

### Linux / macOS

```bash
npm install --prefix frontend
npm install --prefix backend
python3 -m venv ml-service/.venv
ml-service/.venv/bin/python -m pip install -r ml-service/requirements-dev.txt
cp .env.example .env
```

Or use the Makefile (Linux/macOS/WSL):

```bash
make install
```

## Environment variables

Copy `.env.example` to `.env`. Replace `GROQ_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `AUTH_SECRET` before using agents or authentication. Do not commit `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ML_SERVICE_URL` | Python service base URL (Express → ML) |
| `CORS_ORIGIN` | Allowed browser origins for the Express API |
| `CORS_ORIGINS` | Allowed browser origins for the ML service |
| `GROQ_API_KEY` | Groq API key |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` | Langfuse tracing |
| `AUTH_SECRET` | Session signing secret |
| `VITE_API_URL` | API URL used by the frontend (empty locally = Vite proxy) |
| `ML_PORT` | ML service listen port (default 8000) |
| `ML_STORAGE_DIR` | Optional override for dataset/model storage |

See `.env.example` for comments on every variable.

## Database setup (docker compose)

```bash
docker compose up -d
```

Postgres listens on `localhost:5432` with user/password/db `mlapp` / `mlapp` / `mlapp`. The first start applies `database/schema/001_init.sql`. Check status with:

```bash
docker compose ps
# optional: docker compose exec postgres pg_isready -U mlapp
```

Stop with `docker compose down`. Data persists in the `postgres_data` volume.

## ML service setup

The virtual environment lives at `ml-service/.venv`. Training code belongs under `ml-service/app`. Install runtime deps with `requirements.txt`; use `requirements-dev.txt` for uvicorn and pytest as shown above.

## Running the project

From the repo root (after install):

**Linux / macOS / WSL**

```bash
npm run dev:frontend   # http://localhost:5173
npm run dev:backend    # http://localhost:4000/health
npm run dev:ml         # http://localhost:8000/health
# or: make dev-frontend / make dev-backend / make dev-ml
```

**Windows (PowerShell)**

```powershell
npm run dev:frontend
npm run dev:backend
npm run dev:ml:win
```

- Frontend: http://localhost:5173
- API health: http://localhost:4000/health
- ML health: http://localhost:8000/health

## Documentation

| Document | Contents |
|---|---|
| [Frontend and backend](docs/frontend-backend.md) | Pages, studio state, and what Express actually forwards |
| [API and user flow](docs/api-and-flow.md) | Routes, request and response fields, formats, and the five-page flow |
| [ML pipeline](docs/ml-pipeline.md) | Parsing, preprocessing, each estimator, metrics, charts, and prediction |
| [Architecture](docs/architecture/overview.md) | Component boundaries and data flow |
| [API reference stub](docs/api/README.md) | Route index pointing at the live services |
| [Local development](DEVELOPMENT.md) | Day-to-day workflow and conventions |

## API overview

Express forwards parse, store, train, predict, and chart requests to the Python service. The route tables are in [API and user flow](docs/api-and-flow.md).

| Service | Method | Path | Purpose |
|---|---|---|---|
| API | GET | `/health` | API status |
| ML | GET | `/health` | ML service status |
| API | POST | `/datasets/parse` | Upload and parse a tabular file |
| API | POST | `/train` | Train a model |
| API | POST | `/predict` | Predict on a new row |

## Example workflow

1. Upload a dataset on `/` (or use **Use sample table** / `datasets/sample/houses.csv`).
2. Choose the target, features, task, and preparation on `/configure`.
3. Train with grid search or random search on `/train`.
4. Read metrics and charts on `/evaluate`.
5. Submit a new row on `/predict`.

## Testing

**Linux / macOS / WSL**

```bash
npm run test:backend
npm run test:ml
npm run build --prefix frontend
# or: make test
```

**Windows (PowerShell)**

```powershell
npm run test:backend
npm run test:ml:win
npm run build --prefix frontend
```

## Deployment

Deploy the frontend to Vercel, and the API, ML service, and PostgreSQL to Railway. Keep secrets on the server. Set `CORS_ORIGIN` and `VITE_API_URL` per environment. See [docs/vercel-deploy.md](docs/vercel-deploy.md).
