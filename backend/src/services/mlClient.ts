import type { Response } from "express";
import { env } from "../config/env.js";

type ForwardInit = {
  method?: "GET" | "POST";
  json?: unknown;
  form?: FormData;
};

/**
 * Call the Python ML service and relay its answer to the browser.
 *
 * - JSON responses are passed through with the upstream status code.
 * - A non-JSON reply (for example an HTML 502 page from a proxy) becomes a
 *   502 `{ detail }` so the frontend always receives JSON.
 * - A request that takes longer than ML_TIMEOUT_MS becomes a 504.
 * - A connection failure becomes a 503.
 */
export async function forwardToMl(res: Response, path: string, init: ForwardInit = {}) {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (init.form) {
    body = init.form;
  } else if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }

  let response: globalThis.Response;
  try {
    response = await fetch(`${env.ML_SERVICE_URL}${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: AbortSignal.timeout(env.ML_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      res.status(504).json({ detail: "The ML service took too long to respond. Try again." });
      return;
    }
    res.status(503).json({ detail: "The ML service is not running." });
    return;
  }

  const text = await response.text();
  if (!isJson(text)) {
    res.status(502).json({ detail: "The ML service sent an unexpected response." });
    return;
  }
  res.status(response.status).type("application/json").send(text);
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
