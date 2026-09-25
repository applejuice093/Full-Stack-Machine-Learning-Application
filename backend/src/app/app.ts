import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "../config/env.js";
import { datasetRouter } from "../routes/datasets.js";
import { healthRouter } from "../routes/health.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use(healthRouter);
app.use(datasetRouter);
