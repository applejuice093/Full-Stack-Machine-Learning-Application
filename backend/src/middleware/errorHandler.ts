import type { ErrorRequestHandler, RequestHandler } from "express";

/** 404 for unmatched routes — register after all routers. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ detail: "Not found." });
};

/**
 * Central error handler. Multer and unexpected errors land here when a route
 * calls next(err). Always returns JSON `{ detail }` so the frontend can show it.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 500;

  const detail =
    typeof err?.message === "string" && err.message.length > 0
      ? err.message
      : "Internal server error.";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ detail });
};
