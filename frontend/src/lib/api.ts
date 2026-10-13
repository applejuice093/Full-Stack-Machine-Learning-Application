// Base URL of the Express API. Empty string = same origin (local dev uses the Vite proxy).
// Set VITE_API_URL at build time on Vercel, e.g. https://my-backend.vercel.app
const API_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

// Optional direct URL of the Python ML service, only used as a fallback for /dataset/parse.
const ML_URL = (import.meta.env.VITE_ML_URL ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function mlUrl(path: string): string {
  return `${ML_URL || API_URL}${path}`;
}

/** Prefer the server's `{ detail }` message; fall back to status text or a default. */
export async function readErrorDetail(response: Response, fallback = "Request failed."): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { detail?: unknown; message?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
      if (typeof body.message === "string" && body.message.trim()) return body.message;
    } else {
      const text = (await response.text()).trim();
      if (text) return text.slice(0, 400);
    }
  } catch {
    // ignore parse failures
  }
  return response.statusText?.trim() || fallback;
}

/** Fetch JSON from the API; throws an Error with a human-readable message on failure. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new Error("Could not reach the API. Is the backend running?");
  }
  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }
  return (await response.json()) as T;
}
