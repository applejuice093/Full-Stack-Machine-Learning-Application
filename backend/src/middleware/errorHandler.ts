import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env.js";

/** 404 for unmatched routes — register after all routers. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ detail: "Not found." });
};

/** Friendlier messages for errors raised by express.json() (body-parser). */
const BODY_PARSER_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "The request body is not valid JSON.",
  "entity.too.large": "The request body is larger than 4 MB.",
};

/**
 * Central error handler. Multer and unexpected errors land here when a route
 * calls next(err). Always returns JSON `{ detail }` so the frontend can show it.
 * In production, messages from unexpected (5xx) errors are not sent to the
 * browser because they can contain internal details.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 500;

  const known = typeof err?.type === "string" ? BODY_PARSER_MESSAGES[err.type] : undefined;
  const message =
    typeof err?.message === "string" && err.message.length > 0 ? err.message : undefined;

  let detail = known ?? message ?? "Internal server error.";
  if (status >= 500) {
    console.error(err);
    if (env.NODE_ENV === "production") {
      detail = "Internal server error.";
    }
  }

  res.status(status).json({ detail });
};
