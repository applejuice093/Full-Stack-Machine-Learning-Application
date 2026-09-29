# Deploying on Vercel

The repo deploys as **three Vercel projects** from the same Git repository, each with its own Root Directory.

| Project | Root Directory | Framework preset | What it is |
|---|---|---|---|
| `ml-service` | `ml-service` | FastAPI (auto) | Python ML engine (`app/main.py`) |
| `backend` | `backend` | Express (auto) | Node API (`src/index.ts`), proxies to the ML service |
| `frontend` | `frontend` | Vite (auto) | React SPA |

Deploy in this order: ml-service → backend → frontend, because each needs the URL of the previous one.

## 1. ml-service (FastAPI)

Environment variables:

- `CORS_ORIGINS` – comma-separated origins allowed to call it directly (the frontend URL). Optional, the browser normally goes through the backend.
- `BLOB_READ_WRITE_TOKEN` – connect a **Vercel Blob** store to this project (Storage → Blob → Connect); Vercel adds this automatically. Without it, uploaded datasets and trained models live only in the `/tmp` of one function instance and can disappear between requests ("That dataset is no longer stored. Upload it again.").
- `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` – the Python dependencies are ~543 MB, above the 500 MB standard limit. Projects created after 2026-06-30 get Large Functions automatically; set this for older projects.

`vercel.json` sets `maxDuration: 300` for training requests.

## 2. backend (Express)

- `ML_SERVICE_URL` – URL of the ml-service deployment, e.g. `https://ml-service-xyz.vercel.app`
- `CORS_ORIGIN` – frontend URL(s), comma-separated, e.g. `https://frontend-xyz.vercel.app`

## 3. frontend (Vite)

- `VITE_API_URL` – URL of the backend deployment (build-time; redeploy after changing).
- `VITE_ML_URL` – optional, direct ML-service URL used only as a fallback for `/dataset/parse`.

## Limits

- Uploads are capped at **4 MB** (Vercel rejects request bodies over 4.5 MB).
- Training runs synchronously in one request, max 300 s.
