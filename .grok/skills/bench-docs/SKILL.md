---
name: bench-docs
description: >
  bench-docs writes and updates project documentation from the current Bench
  codebase. It covers the frontend, Express API, Python ML service, database,
  setup, and the upload-to-prediction flow. Use it when the user says
  "document the project", "update the docs", "write a README", "refresh the
  documentation", or runs /bench-docs.
---

# Bench docs

Write or update the project docs so they match the code. Read the tree before writing. If a doc and the code disagree, change the doc.

## Read first

- `README.md` and anything under `docs/`
- `frontend/src` routes, studio state, and page components
- `backend/src` routes and how they forward to the ML service
- `ml-service/app` ingestion, training, prediction, and visualization
- `database/schema`, `.env.example`, `docker-compose.yml`, and both dependency files

## What to cover

Keep one useful document, usually the root `README.md`. Add a file under `docs/` only when a topic is too long for the README, and link it from the README.

Cover, from the current code:

- What the app does, in the order a person uses it: upload, analysis, configure, train, evaluate, save, predict
- How to install and run the frontend, the Express API, the Python service, and Postgres
- Environment variables from `.env.example`, with no real secrets
- The HTTP routes that exist, including what each request needs and what it returns
- Supported dataset formats and the formats that are refused
- How preprocessing, search, evaluation metrics, saved models, and prediction work
- Where charts are produced and which page shows them

## Update rules

- Describe behavior that is implemented. If a format, page, or metric is missing, say it is not implemented.
- When code changed since the last docs pass, edit the existing sections. Do not add a second copy of the same fact.
- Keep commands copy-pasteable for this repo on Windows PowerShell.
- After editing, re-read the docs against the routes and pages you cited and fix anything the code no longer does.
