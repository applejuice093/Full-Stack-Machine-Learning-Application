# Local development

## One-time setup

1. Install Node.js 20+ and Python 3.10+.
2. Clone the repo and copy env defaults: `cp .env.example .env`.
3. Install dependencies:

```bash
make install
# or the npm / venv commands in the root README
```

4. Start Postgres (optional until you wire metadata): `make db-up`.

## Day-to-day

Run three terminals (or use your process manager):

```bash
make dev-frontend   # :5173
make dev-backend    # :4000
make dev-ml         # :8000
```

On Windows PowerShell use `npm run dev:frontend`, `npm run dev:backend`, and `npm run dev:ml:win`.

Confirm:

- http://localhost:4000/health
- http://localhost:8000/health
- http://localhost:5173

## Tests

```bash
make test
# or: npm run test:backend && npm run test:ml
```

Backend uses Vitest + Supertest. ML service uses pytest + FastAPI TestClient. Prefer adding a focused test next to any parser, route, or validation change.

## Branching and commits

- Do not commit on `main` for exploratory work; use a short topic branch.
- Keep commits small and descriptive (one coherent change each).
- Do not add or edit `.github/workflows` unless the token has `workflow` scope.
- Never commit `.env`, `ml-service/.venv`, `models/*` artifacts, or `ml-service/data/`.

## Where to change what

| Goal | Start here |
|---|---|
| UI copy / studio steps | `frontend/src/components/studio/` |
| Browser ↔ API helpers | `frontend/src/lib/api.ts`, `ingest.ts` |
| Express routes / validation | `backend/src/routes/`, `backend/src/validators/` |
| Parsing formats | `ml-service/app/ingestion/parse.py` |
| Training / models | `ml-service/app/training/` |
| Charts | `ml-service/app/visualization/` |
| Schema (future metadata) | `database/schema/001_init.sql` |

## Sample data

Use **Use sample table** in the UI, or upload `datasets/sample/houses.csv`. See that folder's README for column meanings.
