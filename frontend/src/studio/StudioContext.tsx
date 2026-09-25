import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { parseCsv, type ParsedDataset } from "@/lib/csv";
import { readDataset, rememberDataset } from "@/lib/ingest";
import sampleCsv from "@/data/sample.csv?raw";
import type { TaskType } from "@/lib/models";
import { modelsFor } from "@/lib/models";

export type PrepSettings = {
  numericImpute: "median" | "mean";
  categoricalImpute: "most_frequent" | "constant";
  scale: boolean;
  dropDuplicates: boolean;
  testSize: number;
};

const defaultPrep: PrepSettings = {
  numericImpute: "median",
  categoricalImpute: "most_frequent",
  scale: true,
  dropDuplicates: true,
  testSize: 0.2,
};

type StudioValue = {
  dataset: ParsedDataset | null;
  error: string | null;
  reading: boolean;
  target: string | null;
  features: string[];
  task: TaskType | null;
  modelId: string | null;
  prep: PrepSettings;
  setPrep: (patch: Partial<PrepSettings>) => void;
  loadFile: (file: File, member?: string) => Promise<void>;
  sourceFile: File | null;
  loadSample: () => void;
  clearDataset: () => void;
  setTarget: (column: string) => void;
  toggleFeature: (column: string) => void;
  setTask: (task: TaskType) => void;
  setModelId: (modelId: string) => void;
  trainResult: unknown;
  setTrainResult: (value: unknown) => void;
};

const StudioContext = createContext<StudioValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [target, setTargetState] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [task, setTaskState] = useState<TaskType | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [prep, setPrepState] = useState<PrepSettings>(defaultPrep);
  const [trainResult, setTrainResult] = useState<unknown>(null);

  const value = useMemo<StudioValue>(() => {
    function resetChoices() {
      setTargetState(null);
      setFeatures([]);
      setTaskState(null);
      setModelId(null);
    }

    return {
      dataset,
      error,
      reading,
      target,
      features,
      task,
      modelId,
      sourceFile,
      prep,
      setPrep(patch) {
        setPrepState((current) => ({ ...current, ...patch }));
      },
      async loadFile(file, member) {
        setReading(true);
        setError(null);
        try {
          const next = await readDataset(file, member);
          setSourceFile(file);
          setDataset(next);
          resetChoices();
          if (next.targetHint && next.headers.includes(next.targetHint)) {
            setTargetState(next.targetHint);
          }
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "This file could not be read.");
        } finally {
          setReading(false);
        }
      },
      loadSample() {
        setError(null);
        setReading(true);
        const next = parseCsv(sampleCsv, "sample-houses.csv");
        void rememberDataset(next).then((stored) => {
          setSourceFile(null);
          setDataset(stored);
          resetChoices();
          setReading(false);
        });
      },
      clearDataset() {
        setDataset(null);
        setSourceFile(null);
        setTrainResult(null);
        setError(null);
        resetChoices();
      },
      setTarget(column) {
        setTargetState(column);
        setFeatures((current) => current.filter((feature) => feature !== column));
      },
      toggleFeature(column) {
        if (column === target) return;
        setFeatures((current) =>
          current.includes(column)
            ? current.filter((feature) => feature !== column)
            : [...current, column],
        );
      },
      setTask(nextTask) {
        setTaskState(nextTask);
        setModelId((current) =>
          current && modelsFor(nextTask).some((model) => model.id === current) ? current : null,
        );
      },
      setModelId,
      trainResult,
      setTrainResult,
    };
  }, [dataset, error, features, modelId, prep, reading, sourceFile, target, task, trainResult]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioValue {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error("useStudio must be used inside StudioProvider");
  }
  return value;
}
