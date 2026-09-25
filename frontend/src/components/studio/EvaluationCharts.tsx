import { useEffect, useState } from "react";
import { ChartFrame } from "./ChartFrame";

const titles: Record<string, string> = {
  confusion: "Confusion matrix heatmap",
  roc: "ROC curve",
  actual: "Actual vs predicted",
  residual: "Residual plot",
};

export function EvaluationCharts({ runId }: { runId: string }) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/visualize/evaluation/${runId}`)
      .then(async (response) => {
        const body = (await response.json()) as { images?: Record<string, string>; detail?: string };
        if (!response.ok) throw new Error(body.detail ?? "The evaluation charts could not be loaded.");
        if (!cancelled) setImages(body.images ?? {});
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The evaluation charts could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="mt-6 grid gap-8">
      {error ? <p className="text-sm text-[#7A3E32]">{error}</p> : null}
      {Object.entries(images).map(([name, image]) => (
        <ChartFrame key={name} title={titles[name] ?? name} image={image} />
      ))}
    </div>
  );
}
