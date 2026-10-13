import { Router } from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const healthRouter = Router();

const startedAt = Date.now();

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = packageVersion();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  });
});
