# Frontend

React + Vite + TypeScript + Tailwind CSS + shadcn/ui for the Bench studio UI.

Animation libraries used by the product UI:

- `framer-motion` — component transitions
- `gsap` — timeline and scroll motion
- `lottie-react` — vector animations
- `@tsparticles/react` and `@tsparticles/slim` — particle fields

Re-exports live in `src/lib/animation.ts`. Studio state is in `src/studio/StudioContext.tsx`. API helpers are in `src/lib/api.ts` (`apiUrl`, `mlUrl`, `apiJson`, `readErrorDetail`).

## Requirements

Node.js 20+ and npm 10+. See the repository root README for the full stack.

## Install and run

```bash
# from repo root
npm install --prefix frontend
npm run dev --prefix frontend
```

Or from this directory:

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173. In development, Vite proxies `/datasets`, `/train`, `/predict`, and `/visualize` to the Express API on port 4000. Leave `VITE_API_URL` empty locally; set it to the public API URL for production builds.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## Useful paths

| Path | Role |
|---|---|
| `src/components/studio/` | Upload → configure → train → evaluate → predict UI |
| `src/lib/ingest.ts` | Upload / parse orchestration |
| `src/data/sample.csv` | Built-in sample table (mirrors `datasets/sample/houses.csv`) |
