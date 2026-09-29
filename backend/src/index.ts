// Vercel entrypoint: Vercel's Express preset looks for src/index.ts that imports express
// and default-exports the app. Local development still uses src/app/server.ts (app.listen).
import type { Express } from "express";
import { app } from "./app/app.js";

const handler: Express = app;

export default handler;
