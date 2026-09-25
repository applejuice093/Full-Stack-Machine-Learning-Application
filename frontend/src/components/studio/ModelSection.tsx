import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ParsedDataset } from "@/lib/csv";
import { modelsFor } from "@/lib/models";
import { useStudio } from "@/studio/StudioContext";

export type TrainResult = {
  modelId: string;
  searchMethod: string;
  bestParameters: Record<string, string | number | boolean | null>;
  parameterSpace: Record<string, Array<string | number | boolean | null>>;
  bestCvScore: number;
  testScore: number;
  cvFolds: number;
  durationSeconds: number;
  trainRows: number;
  testRows: number;
  removedDuplicates: number;
  scoring: string;
  runId: string;
  evaluation?: ClassificationEvaluation | RegressionEvaluation;
};

type ClassificationEvaluation = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc?: number | null;
  confusionMatrix: { labels: string[]; counts: number[][] };
};

type RegressionEvaluation = {
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
};

type Prediction = {
  prediction: string | number;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export function ModelSection() {
  const reduce = useReducedMotion();
  const { dataset, target, features, task, modelId, prep, setModelId, trainResult, setTrainResult } = useStudio();
  const ready = Boolean(dataset && target && features.length > 0 && task);
  const options = task ? modelsFor(task) : [];
  const selected = options.find((model) => model.id === modelId);
  const [search, setSearch] = useState<"grid" | "random">("grid");
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  return (
    <section id="models" className="min-w-0 scroll-mt-24 border-t border-[#D8D6CF] pt-16">
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-[#85827B] uppercase">
        <span className="size-2 rounded-full border border-[#9A927F]" aria-hidden="true" />
        Step 3 · Train
      </p>
      <h2 className="mt-4 text-4xl leading-none font-bold tracking-tight text-[#171717] md:text-5xl">Train a model</h2>
      <p className="mt-4 max-w-[520px] text-lg leading-relaxed text-[#66645F]">
        Only algorithms that match the task are listed.
      </p>

      {!dataset ? (
        <p className="text-card mt-8 px-4 py-6 text-sm">
          Upload a CSV before choosing a model.
        </p>
      ) : !ready ? (
        <p className="text-card mt-8 px-4 py-6 text-sm">
          Choose a target, at least one input column, and a task first.
        </p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.fieldset
            key={task}
            className="mt-8"
            initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={reduce ? undefined : { opacity: 0, transform: "translateY(8px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <legend className="sr-only">
              {task === "classification" ? "Classification models" : "Regression models"}
            </legend>
            <div className="text-card">
              {options.map((model) => {
                const checked = model.id === modelId;
                return (
                  <label
                    key={model.id}
                    className={`grid cursor-pointer grid-cols-[auto_1fr] gap-4 border-b border-border px-4 py-4 transition-colors duration-150 ease-[var(--ease-out)] last:border-b-0 ${
                      checked ? "bg-[var(--paper)]" : "bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={checked}
                      onChange={() => setModelId(model.id)}
                      className="mt-1 accent-[var(--mark)]"
                    />
                    <span>
                      <span className="block text-base text-foreground">{model.name}</span>
                      <span className="mt-1 block text-sm text-foreground">{model.summary}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </motion.fieldset>
        </AnimatePresence>
      )}

      {selected && target ? (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-[#171717]">Train and tune</h3>
          <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-[#66645F]">
            {selected.name} predicts {target} from {features.length}{" "}
            {features.length === 1 ? "column" : "columns"}. The search uses only the training rows.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["grid", "Grid search"],
                ["random", "Random search"],
              ] as const
            ).map(([value, name]) => (
              <button
                key={value}
                type="button"
                aria-pressed={search === value}
                onClick={() => setSearch(value)}
                className={`h-10 border px-3 text-sm transition-colors duration-150 ease-out ${
                  search === value
                    ? "border-[#9A927F] bg-white text-[#171717]"
                    : "border-[#D8D6CF] bg-transparent text-[#66645F]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={training || !dataset?.datasetId}
            onClick={() => {
              if (!dataset?.datasetId || !modelId || !task) return;
              setTraining(true);
              setTrainError(null);
              void fetch("/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  datasetId: dataset.datasetId,
                  target,
                  features,
                  task,
                  modelId,
                  search,
                  testSize: prep.testSize,
                  numericImpute: prep.numericImpute,
                  categoricalImpute: prep.categoricalImpute,
                  scale: prep.scale,
                  dropDuplicates: prep.dropDuplicates,
                }),
              })
                .then(async (response) => {
                  const body = (await response.json()) as TrainResult & { detail?: string };
                  if (!response.ok) throw new Error(body.detail ?? "Training failed.");
                  setTrainResult(body);
                })
                .catch((caught: unknown) => {
                  setTrainResult(null);
                  setTrainError(caught instanceof Error ? caught.message : "Training failed.");
                })
                .finally(() => setTraining(false));
            }}
            className="mt-6 inline-flex h-14 items-center rounded-lg bg-[#171717] px-5 text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            {training ? "Training" : "Train model"}
          </button>
          {training ? (
            <p className="mt-3 text-sm text-[#66645F]">Fitting the training rows and comparing parameter settings.</p>
          ) : null}
          {!dataset?.datasetId ? (
            <p className="mt-3 text-sm text-[#66645F]">
              Upload the file again so the training service can store the full table.
            </p>
          ) : null}
          {trainError ? (
            <p className="mt-3 text-sm text-[#7A3E32]" role="alert">
              {trainError}
            </p>
          ) : null}
          {trainResult ? <TrainSummary result={trainResult as TrainResult} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function TrainSummary({ result }: { result: TrainResult }) {
  const scoreName = result.scoring === "r2" ? "R²" : "Accuracy";
  return (
    <div className="mt-6">
      <div className="grid overflow-hidden rounded-xl border border-[#D8D6CF] bg-white sm:grid-cols-3">
        <Score label={`Best CV ${scoreName}`} value={result.bestCvScore.toFixed(3)} />
        <Score label={`Test ${scoreName}`} value={result.testScore.toFixed(3)} />
        <Score label="Training rows" value={String(result.trainRows)} />
      </div>
      <div className="mt-4 rounded-xl border border-[#D8D6CF] bg-white p-4">
        <h4 className="text-sm font-medium tracking-[0.12em] text-[#85827B] uppercase">Best configuration</h4>
        <dl className="mt-3 grid gap-3">
          {Object.entries(result.bestParameters).map(([key, value]) => (
            <div key={key} className="grid gap-1 border-b border-[#D8D6CF] pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[12rem_1fr]">
              <dt className="text-sm text-[#66645F]">{parameterName(key)}</dt>
              <dd className="text-sm font-semibold text-[#171717]">{String(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-[#66645F]">
          {result.searchMethod === "grid" ? "Grid" : "Random"} search, {result.cvFolds} folds,{" "}
          {result.testRows} test rows, {result.removedDuplicates} duplicate rows removed, {result.durationSeconds}s.
          The test score was not used to choose these parameters.
        </p>
      </div>
    </div>
  );
}

export function EvaluationPanel({ result }: { result: TrainResult }) {
  const evaluation = result.evaluation;
  if (!evaluation) return null;
  if ("mae" in evaluation) {
    return (
      <div className="mt-4 grid overflow-hidden rounded-xl border border-[#D8D6CF] bg-white sm:grid-cols-2 lg:grid-cols-4">
        <Score label="MAE" value={evaluation.mae.toFixed(3)} />
        <Score label="MSE" value={evaluation.mse.toFixed(3)} />
        <Score label="RMSE" value={evaluation.rmse.toFixed(3)} />
        <Score label="R²" value={evaluation.r2.toFixed(3)} />
      </div>
    );
  }
  return (
    <div className="mt-4">
      <div className="grid overflow-hidden rounded-xl border border-[#D8D6CF] bg-white sm:grid-cols-2 lg:grid-cols-4">
        <Score label="Accuracy" value={evaluation.accuracy.toFixed(3)} />
        <Score label="Precision" value={evaluation.precision.toFixed(3)} />
        <Score label="Recall" value={evaluation.recall.toFixed(3)} />
        <Score label="F1" value={evaluation.f1.toFixed(3)} />
      </div>
      {evaluation.rocAuc === null || evaluation.rocAuc === undefined ? (
        <p className="mt-3 text-sm text-[#66645F]">ROC-AUC is not available for this test split.</p>
      ) : (
        <p className="mt-3 text-sm text-[#171717]">ROC-AUC {evaluation.rocAuc.toFixed(3)}</p>
      )}
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#D8D6CF] bg-white">
        <table className="w-full text-sm">
          <caption className="px-4 py-3 text-left text-[11px] font-medium tracking-[0.14em] text-[#85827B] uppercase">
            Confusion matrix
          </caption>
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-[#66645F]">Actual</th>
              {evaluation.confusionMatrix.labels.map((label) => (
                <th key={label} className="px-3 py-2 text-right font-medium text-[#66645F]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluation.confusionMatrix.counts.map((row, rowIndex) => (
              <tr key={evaluation.confusionMatrix.labels[rowIndex]} className="border-t border-[#D8D6CF]">
                <th className="px-3 py-2 text-left font-medium text-[#171717]">
                  {evaluation.confusionMatrix.labels[rowIndex]}
                </th>
                {row.map((count, columnIndex) => (
                  <td key={evaluation.confusionMatrix.labels[columnIndex]} className="px-3 py-2 text-right text-[#171717]">
                    {count}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PredictPanel({
  runId,
  features,
  dataset,
}: {
  runId: string;
  features: string[];
  dataset: ParsedDataset | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);

  return (
    <form
      className="mt-6 rounded-xl border border-[#D8D6CF] bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        void fetch("/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, values }),
        })
          .then(async (response) => {
            const body = (await response.json()) as Prediction & { detail?: string };
            if (!response.ok) throw new Error(body.detail ?? "Prediction failed.");
            setResult(body);
          })
          .catch((caught: unknown) => {
            setResult(null);
            setError(caught instanceof Error ? caught.message : "Prediction failed.");
          })
          .finally(() => setPending(false));
      }}
    >
      <h4 className="text-sm font-medium tracking-[0.12em] text-[#85827B] uppercase">Predict a new row</h4>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => {
          const kind = dataset?.schema?.find((column) => column.name === feature)?.inferredType;
          const numeric = kind === "integer" || kind === "float";
          return (
            <label key={feature} className="grid gap-2 text-sm text-[#171717]">
              {feature}
              <input
                required
                type={numeric ? "number" : "text"}
                step="any"
                value={values[feature] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [feature]: event.target.value }))}
                className="h-11 rounded-lg border border-[#D8D6CF] px-3"
              />
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex h-12 items-center rounded-lg bg-[#171717] px-5 text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#2a2a2a] disabled:opacity-50"
      >
        {pending ? "Predicting" : "Predict"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[#7A3E32]" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="mt-4 text-sm text-[#171717]">
          Predicted output: <span className="font-semibold">{String(result.prediction)}</span>
          {typeof result.confidence === "number"
            ? `. Confidence ${(result.confidence * 100).toFixed(1)}%.`
            : "."}
        </p>
      ) : null}
    </form>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[#D8D6CF] px-6 py-5 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l">
      <p className="text-[11px] font-medium tracking-[0.14em] text-[#85827B] uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[#171717]">{value}</p>
    </div>
  );
}

function parameterName(key: string): string {
  const name = key.split("__").pop() ?? key;
  return name.replaceAll("_", " ");
}
