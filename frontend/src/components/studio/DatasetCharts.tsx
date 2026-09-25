import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/studio/StudioContext";
import { ChartFrame } from "./ChartFrame";

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
  const sectionRef = useRef<HTMLElement>(null);
  const returnScroll = useRef(0);

  useEffect(() => {
    setSelected(null);
    if (!dataset?.datasetId) {
      setFigures(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void fetch("/visualize/dataset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId: dataset.datasetId }),
    })
      .then(async (response) => {
        const body = (await response.json()) as Figures & { detail?: string };
        if (!response.ok) throw new Error(body.detail ?? "The dataset charts could not be drawn.");
        if (!cancelled) setFigures(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The dataset charts could not be drawn.");
      });
    return () => {
      cancelled = true;
    };
  }, [dataset?.datasetId]);

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
      {error ? <p className="mt-3 text-sm text-[#7A3E32]">{error}</p> : null}
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

function Chart({ title, image }: { title: string; image: string | null }) {
  if (!image) return null;
  return <ChartFrame title={title} image={image} />;
}
