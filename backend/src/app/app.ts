import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "../config/env.js";
import { datasetRouter } from "../routes/datasets.js";
import { healthRouter } from "../routes/health.js";

export const app = express();

app.use(helmet());
// CORS_ORIGIN accepts a comma-separated list, e.g. "https://my-frontend.vercel.app,http://localhost:5173".
const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.includes("*") ? true : allowedOrigins }));
// Vercel rejects request bodies above 4.5 MB, so keep JSON bodies under that.
app.use(express.json({ limit: "4mb" }));
app.use(healthRouter);
app.use(datasetRouter);
