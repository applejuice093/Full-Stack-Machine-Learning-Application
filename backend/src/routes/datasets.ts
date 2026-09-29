import { Router, type Request, type Response } from "express";
import multer from "multer";
import { env } from "../config/env.js";

// Vercel Functions accept request bodies up to 4.5 MB, so uploads are capped at 4 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const datasetRouter = Router();

async function forwardJson(req: Request, res: Response, path: string) {
  try {
    const response = await fetch(`${env.ML_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const body = await response.text();
    res.status(response.status).type("application/json").send(body);
  } catch {
    res.status(503).json({ detail: "The ML service is not running." });
  }
}

datasetRouter.post("/datasets/store", async (req, res) => {
  await forwardJson(req, res, "/datasets/store");
});

datasetRouter.post("/train", async (req, res) => {
  await forwardJson(req, res, "/train");
});

datasetRouter.post("/predict", async (req, res) => {
  await forwardJson(req, res, "/predict");
});

datasetRouter.post("/visualize/dataset", async (req, res) => {
  await forwardJson(req, res, "/visualize/dataset");
});

datasetRouter.get("/visualize/evaluation/:runId", async (req, res) => {
  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/visualize/evaluation/${req.params.runId}`);
    const body = await response.text();
    res.status(response.status).type("application/json").send(body);
  } catch {
    res.status(503).json({ detail: "The ML service is not running." });
  }
});

function uploadSingle(req: Request, res: Response, next: (err?: unknown) => void) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ detail: "This file is larger than 4 MB. Use a smaller file." });
      return;
    }
    next(err);
  });
}

datasetRouter.post("/datasets/parse", uploadSingle, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "Choose a file." });
    return;
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(req.file.buffer)]), req.file.originalname);
  const member = req.body?.member;
  if (typeof member === "string" && member.length > 0) {
    form.append("member", member);
  }

  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/dataset/parse`, {
      method: "POST",
      body: form,
    });
    const body = await response.text();
    res.status(response.status).type("application/json").send(body);
  } catch {
    res.status(503).json({ detail: "The ML service is not running." });
  }
});
