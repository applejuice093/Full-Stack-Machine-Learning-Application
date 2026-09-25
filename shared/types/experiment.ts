export const experimentStatuses = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type ExperimentStatus = (typeof experimentStatuses)[number];

export type TaskType = "classification" | "regression";
