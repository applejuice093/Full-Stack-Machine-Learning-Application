import { Router, type Request, type Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { forwardToMl } from "../services/mlClient.js";
import {
  datasetFigureBodySchema,
  mlIdSchema,
  predictBodySchema,
  storeBodySchema,
  trainBodySchema,
} from "../validators/datasets.js";

// Vercel Functions accept request bodies up to 4.5 MB, so uploads are capped at 4 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const datasetRouter = Router();

function validationError(res: Response, error: ZodError) {
  const first = error.issues[0];
  const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
  res.status(400).json({ detail: `${path}${first?.message ?? "Invalid request body."}` });
}

datasetRouter.post("/datasets/store", async (req, res) => {
  const parsed = storeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(res, parsed.error);
    return;
  }
  await forwardToMl(res, "/datasets/store", { json: parsed.data });
});

datasetRouter.post("/train", async (req, res) => {
  const parsed = trainBodySchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(res, parsed.error);
    return;
  }
  await forwardToMl(res, "/train", { json: parsed.data });
});

datasetRouter.post("/predict", async (req, res) => {
  const parsed = predictBodySchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(res, parsed.error);
    return;
  }
  await forwardToMl(res, "/predict", { json: parsed.data });
});

datasetRouter.post("/visualize/dataset", async (req, res) => {
  const parsed = datasetFigureBodySchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(res, parsed.error);
    return;
  }
  await forwardToMl(res, "/visualize/dataset", { json: parsed.data });
});

datasetRouter.get("/visualize/evaluation/:runId", async (req, res) => {
  // Validate before building the upstream URL so the id cannot add path segments.
  const runId = mlIdSchema.safeParse(req.params.runId);
  if (!runId.success) {
    res.status(400).json({ detail: "Unknown trained model." });
    return;
  }
  await forwardToMl(res, `/visualize/evaluation/${encodeURIComponent(runId.data)}`);
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
  // `member` picks one file inside an uploaded archive (zip/tar).
  const member = typeof req.body?.member === "string" ? req.body.member.trim() : "";
  if (member.length > 1024) {
    res.status(400).json({ detail: "member: archive path is too long." });
    return;
  }
  if (member.length > 0) {
    form.append("member", member);
  }

  await forwardToMl(res, "/dataset/parse", { form });
});
