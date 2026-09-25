# Frontend and backend

Bench is a browser app for turning a table into a trained scikit-learn model and a prediction. The React app is the only interface. The Express process forwards dataset, training, chart, and prediction requests to the Python service. Postgres is defined for later metadata storage. The running upload and training path stores tables as Parquet files and models as joblib files. It does not write those artifacts to Postgres.

Authentication, LangGraph agents, Groq calls, and Langfuse traces are named in the environment file and some packages are installed. None of those features are wired into a request.

## How the pieces talk

```text
Browser (Vite, port 5173)
    |  same-origin /datasets, /train, /predict, /visualize
    v
Express (port 4000)
    |  ML_SERVICE_URL
    v
FastAPI (port 8000)
    |-- ml-service/data/datasets/{id}.parquet
    |-- models/{runId}.joblib and PNG charts
```

In development, Vite proxies those paths to Express so the page does not call port 8000 directly. CSV files can still be parsed in the browser if both services are down. Every other format, and every train or predict call, needs the Python service.

## Frontend

Stack: React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui (Nova), React Router, Framer Motion, anime.js, and tsParticles. The `@` alias maps to `frontend/src`.

`main.tsx` mounts the app. `App.tsx` wraps `StudioProvider` and `BrowserRouter` around `StudioShell`.

### Pages

| Path | What it shows | What blocks it |
|---|---|---|
| `/` | Upload, sample table, file summary, column chips, sample rows, dataset charts | Nothing |
| `/configure` | Target, input columns, task, preparation | No dataset in memory |
| `/train` | Models for the chosen task, search choice, train button, best parameters | No dataset, or no target and task |
| `/evaluate` | Metric numbers and saved chart images | No train result in this browser session |
| `/predict` | One field per selected feature, predicted output, class confidence when present | No train result in this browser session |

State lives in `StudioContext` for the lifetime of the tab. Refreshing the page clears the dataset, the target, and the trained run. The Parquet file and the joblib file remain on disk, but the UI does not reload them.

### Studio state

`frontend/src/studio/StudioContext.tsx` holds:

- `dataset`: name, headers, preview rows, full row count, schema, optional `datasetId`, optional target hint, and candidate sheet or array names
- `sourceFile`: the last uploaded `File`, used to re-parse another sheet or array
- `target`, `features`, `task`, `modelId`
- `prep`: numeric impute (`median` or `mean`), categorical impute (`most_frequent` or `constant`), whether to scale, whether to drop duplicate rows, and test size from 0.10 to 0.40
- `trainResult`: the JSON returned by `POST /train`

Choosing a target removes that column from the feature list. Changing the task clears a model that belongs to the other task. ARFF and LIBSVM parses set `targetHint`. After a successful load, that column is preselected. The column stays in the table.

### Upload and parsing in the browser

`UploadSection` accepts drag-and-drop and **Browse files**, plus **Use sample table** (`frontend/src/data/sample.csv`, 12 house rows) and **Remove file**. The file limit is 8 MB.

`readDataset` in `frontend/src/lib/ingest.ts` posts the file to `/datasets/parse`, then to `/dataset/parse` if Express is down. A 4xx response is shown as the parser message. If both calls fail and the file is CSV, `frontend/src/lib/csv.ts` parses it locally and `rememberDataset` posts the rows to `/datasets/store` so training still has an id. The sample button uses that store path directly.

The UI shows the first six preview rows. Wide tables scroll inside the sample-rows card. The page itself does not scroll sideways. Column chips prefer the server schema (`inferredType`, `missingCount`). If the schema is absent, the browser infers number versus text from the preview.

When a file contains more than one sheet or array, a select labeled **Also in this file** calls `loadFile` again with `member`.

`DatasetCharts` loads after `datasetId` exists. Feature charts are one image per column. Clicking a chart enlarges it. **<** returns to the grid and restores the scroll position. Correlation and missing-value charts each have **Full screen**. **Exit full screen**, **<**, and Escape close that view and put the page back where it was.

### Configure

`ConfigureSection` is step 2.

- Target: a select of column name and kind.
- Inputs: toggle buttons. The target is disabled.
- Task: classification or regression.
- Preparation: missing numbers (median or mean), missing categories (most common value, or the literal `missing`), standardize or leave numbers as recorded, drop or keep exact duplicate rows, and a hold-out slider of 10, 15, 20, 25, 30, 35, or 40 percent. The default hold-out is 20 percent.

The panel states that categories are one-hot encoded and that impute and scale are fitted only on training rows. Naive Bayes ignores scaling even if Standardize is selected. The UI does not offer another encoder.

### Train, evaluate, predict

`ModelSection` lists only the models for the selected task. Search is **Grid search** or **Random search**. **Train model** posts the dataset id, target, features, task, model id, search, test size, and preparation flags to `/train`.

The response is stored on the studio context. The train page shows the best cross-validation score, the test score, the training-row count, and the winning parameters with the `model__` prefix stripped for display.

`/evaluate` renders `EvaluationPanel` and then `EvaluationCharts`, which fetches `/visualize/evaluation/{runId}`. Classification shows accuracy, precision, recall, F1, ROC-AUC when it was computed, and the numeric confusion matrix. Regression shows MAE, MSE, RMSE, and R². Each chart image has **Full screen**.

`/predict` renders `PredictPanel`. Numeric schema types use a number input. Other types use text. Submit posts `{ runId, values }` to `/predict`. Classification appends a confidence percentage. Regression prints only the number.

### Look and motion

Colors are paper `#F7F6F2`, ink `#171717`, secondary text `#66645F`, muted `#85827B`, line `#D8D6CF`, white cards, and stone `#9A927F` for selection marks. Body type is Geist. Display headings are bold Geist, not a second family.

A tsParticles field sits behind the pages and turns off when the user prefers reduced motion. Decorative arcs are static SVG. anime.js counts the file, row, and column numbers. Framer Motion still fades the model list when the task changes. The header underline is a CSS border on the active `NavLink`, not an animated pill.

## Backend

`backend/src/app/server.ts` listens on `env.PORT` (default 4000). `app.ts` applies Helmet, CORS for `CORS_ORIGIN`, and JSON bodies up to 2 MB. Routes are health plus the dataset router.

Express does not train models and does not open Postgres. `pg` is installed. `database/schema/001_init.sql` creates users, datasets, experiments, models, metrics, predictions, agent runs, and audit logs, and enables `vector`. Docker Compose starts `pgvector/pgvector:pg16` and applies that file on first boot. Nothing in the request path reads or writes those tables yet.

### What Express forwards

| Browser path | ML path | Body |
|---|---|---|
| `POST /datasets/parse` | `POST /dataset/parse` | multipart file, optional `member` |
| `POST /datasets/store` | `POST /datasets/store` | JSON table |
| `POST /train` | `POST /train` | JSON training request |
| `POST /predict` | `POST /predict` | JSON `runId` and values |
| `POST /visualize/dataset` | `POST /visualize/dataset` | JSON `datasetId` |
| `GET /visualize/evaluation/:runId` | `GET /visualize/evaluation/{runId}` | none |

`POST /datasets/parse` keeps the file in memory with Multer, limit 8 MB, and sends it on as `multipart/form-data`. The other posts copy the JSON body. If the Python process is down, Express returns 503 with `detail: "The ML service is not running."`

`GET /health` returns `{ "status": "ok", "service": "backend" }`.

### Config the API actually reads

From `backend/src/config/env.ts`:

| Variable | Default | Used for |
|---|---|---|
| `PORT` | `4000` | Listen port |
| `ML_SERVICE_URL` | `http://localhost:8000` | Forward target |
| `CORS_ORIGIN` | `http://localhost:5173` | Browser origin |
| `NODE_ENV` | `development` | Environment name |
| `DATABASE_URL` | unset | Accepted, not queried |
| `GROQ_API_KEY`, `LANGFUSE_*`, `AUTH_SECRET` | unset | Accepted, not used by a route |

### Run

```powershell
npm install --prefix frontend
npm install --prefix backend
py -3.14 -m venv ml-service\.venv
ml-service\.venv\Scripts\python -m pip install -r ml-service\requirements.txt
Copy-Item .env.example .env
npm run dev:frontend
npm run dev:backend
npm run dev:ml
```

Frontend: http://localhost:5173. API health: http://localhost:4000/health. ML health: http://localhost:8000/health.

Postgres, when you want the unused schema:

```powershell
docker compose up -d
```
