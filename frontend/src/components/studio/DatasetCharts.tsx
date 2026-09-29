import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/studio/StudioContext";
import { ChartFrame } from "./ChartFrame";
import { apiUrl } from "@/lib/api";

type Distribution = {
  name: string;
  image: string;
};

type Figures = {
  distributions: Distribution[];
  correlation: string | null;
  missing: string | null;
  notes: string[];
};

export function DatasetCharts() {
  const { dataset } = useStudio();
  const [figures, setFigures] = useState<Figures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const returnScroll = useRef(0);

  useEffect(() => {
    setSelected(null);
    // Drop the previous dataset's charts right away so stale graphs never linger.
    setFigures(null);
    setError(null);
    if (!dataset?.datasetId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void loadFigures(dataset.datasetId, controller.signal)
      .then((body) => setFigures(body))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "The dataset charts could not be drawn.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [dataset?.datasetId, attempt]);

  if (!dataset?.datasetId) return null;

  const chosen = figures?.distributions.find((chart) => chart.name === selected) ?? null;

  return (
    <section ref={sectionRef} className="mt-16 min-w-0">
      <div className="flex items-center gap-3">
        {chosen ? (
          <button
            type="button"
            aria-label="Back to all graphs"
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              setSelected(null);
              const top = returnScroll.current;
              requestAnimationFrame(() => window.scrollTo(0, top));
            }}
            className="inline-flex h-8 w-8 items-center justify-center border border-[#D8D6CF] bg-white text-sm text-[#171717] transition-colors duration-150 ease-out hover:bg-[#F1EFE9]"
          >
            &lt;
          </button>
        ) : null}
        <h2 className="text-lg font-semibold text-[#171717]">
          {chosen ? chosen.name : "Feature distributions"}
        </h2>
      </div>
      {error ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-[#7A3E32]">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="border border-[#D8D6CF] bg-white px-3 py-1 text-sm text-[#171717] transition-colors duration-150 ease-out hover:bg-[#F1EFE9]"
          >
            Try again
          </button>
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-live="polite" className="mt-4">
          <p className="text-sm text-[#66645F]">Drawing the feature distribution graphs… this can take a few seconds.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.min(Math.max(dataset.headers.length, 1), 6) }, (_, index) => (
              <div key={index} className="aspect-[3/2] animate-pulse rounded-xl border border-[#D8D6CF] bg-[#F1EFE9]" />
            ))}
          </div>
        </div>
      ) : null}
      {chosen ? (
        <figure className="mt-4 w-fit max-w-full overflow-hidden rounded-xl border border-[#D8D6CF] bg-white">
          <img
            src={`data:image/png;base64,${chosen.image}`}
            alt={`${chosen.name} distribution`}
            className="block h-auto w-full max-w-3xl"
          />
        </figure>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {figures?.distributions.map((chart) => (
            <button
              key={chart.name}
              type="button"
              onClick={() => {
                returnScroll.current = window.scrollY;
                setSelected(chart.name);
                requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: "start" }));
              }}
              className="overflow-hidden rounded-xl border border-[#D8D6CF] bg-white text-left transition-colors duration-150 ease-out hover:border-[#9A927F]"
            >
              <img src={`data:image/png;base64,${chart.image}`} alt="" className="block h-auto w-full" />
              <span className="block px-3 py-2 text-sm text-[#171717]">{chart.name}</span>
            </button>
          ))}
        </div>
      )}

      {!chosen ? (
        <div className="mt-8 grid gap-8">
          {figures?.notes.map((note) => (
            <p key={note} className="text-sm text-[#66645F]">
              {note}
            </p>
          ))}
          <Chart title="Correlation" image={figures?.correlation ?? null} />
          <Chart title="Missing values" image={figures?.missing ?? null} />
        </div>
      ) : null}
    </section>
  );
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// The ML service runs as a serverless function: the first request after a cold start (or a
// transient gateway error) can fail or be slow, so retry a couple of times before giving up.
async function loadFigures(datasetId: string, signal: AbortSignal, retries = 2): Promise<Figures> {
  for (let tryIndex = 0; ; tryIndex += 1) {
    let response: Response;
    try {
      response = await fetch(apiUrl("/visualize/dataset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId }),
        signal,
      });
    } catch (caught) {
      if (signal.aborted) throw caught;
      if (tryIndex < retries) {
        await wait(1500 * (tryIndex + 1), signal);
        continue;
      }
      throw new Error("The chart service could not be reached. Try again.");
    }
    if (response.ok) {
      const body = (await response.json()) as Figures;
      return { ...body, distributions: body.distributions ?? [], notes: body.notes ?? [] };
    }
    if (RETRYABLE_STATUS.has(response.status) && tryIndex < retries) {
      await wait(1500 * (tryIndex + 1), signal);
      continue;
    }
    // Error bodies are not always JSON (e.g. a gateway timeout page), so read them as text.
    const text = await response.text();
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      detail = undefined;
    }
    throw new Error(detail ?? `The dataset charts could not be drawn (HTTP ${response.status}).`);
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

function Chart({ title, image }: { title: string; image: string | null }) {
  if (!image) return null;
  return <ChartFrame title={title} image={image} />;
}
