import { z } from "zod";

/** Body for POST /datasets/store (browser-parsed CSV fallback). */
export const storeBodySchema = z.object({
  filename: z.string().min(1),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

/** Body for POST /train — mirrors the ML service TrainBody. */
export const trainBodySchema = z.object({
  datasetId: z.string().min(1),
  target: z.string().min(1),
  features: z.array(z.string()).min(1),
  task: z.enum(["classification", "regression"]),
  modelId: z.string().min(1),
  search: z.enum(["grid", "random"]).optional().nullable(),
  testSize: z.number().gt(0.05).lt(0.5).default(0.2),
  seed: z.number().int().optional().default(42),
  paramGrid: z.record(z.string(), z.unknown()).optional().nullable(),
  numericImpute: z.enum(["median", "mean"]).optional().default("median"),
  categoricalImpute: z.enum(["most_frequent", "constant"]).optional().default("most_frequent"),
  scale: z.boolean().optional().default(true),
  dropDuplicates: z.boolean().optional().default(true),
});

/** Body for POST /predict. */
export const predictBodySchema = z.object({
  runId: z.string().min(1),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});

export type StoreBody = z.infer<typeof storeBodySchema>;
export type TrainBody = z.infer<typeof trainBodySchema>;
export type PredictBody = z.infer<typeof predictBodySchema>;
