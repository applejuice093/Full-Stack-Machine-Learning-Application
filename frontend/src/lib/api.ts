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
