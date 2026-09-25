import { NavLink, Route, Routes } from "react-router-dom";
import { ConfigureSection } from "./ConfigureSection";
import { DatasetCharts } from "./DatasetCharts";
import { EvaluationCharts } from "./EvaluationCharts";
import { EvaluationPanel, ModelSection, PredictPanel, type TrainResult } from "./ModelSection";
import { ParticleField } from "./ParticleField";
import { UploadSection } from "./UploadSection";
import { useStudio } from "@/studio/StudioContext";

const links = [
  { to: "/", label: "Upload", end: true },
  { to: "/configure", label: "Configure", end: false },
  { to: "/train", label: "Train", end: false },
  { to: "/evaluate", label: "Evaluate", end: false },
  { to: "/predict", label: "Predict", end: false },
];

export function StudioShell() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-background text-foreground">
      <ParticleField />
      <Decor />
      <Header />
      <main className="relative z-10 mx-auto w-full min-w-0 max-w-[1360px] px-6 pt-16 pb-24 md:px-12">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/train" element={<TrainPage />} />
          <Route path="/evaluate" element={<EvaluatePage />} />
          <Route path="/predict" element={<PredictPage />} />
        </Routes>
      </main>
    </div>
  );
}

function UploadPage() {
  return (
    <>
      <UploadSection />
      <DatasetCharts />
    </>
  );
}

function ConfigurePage() {
  const { dataset } = useStudio();
  if (!dataset) return <Missing step="Upload a dataset" to="/" />;
  return <ConfigureSection />;
}

function TrainPage() {
  const { dataset, target, task } = useStudio();
  if (!dataset) return <Missing step="Upload a dataset" to="/" />;
  if (!target || !task) return <Missing step="Choose a target and a task" to="/configure" />;
  return <ModelSection />;
}

function EvaluatePage() {
  const { trainResult } = useStudio();
  const result = trainResult as TrainResult | null;
  if (!result) return <Missing step="Train a model" to="/train" />;
  return (
    <section>
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-[#85827B] uppercase">
        <span className="size-2 rounded-full border border-[#9A927F]" />
        Step 4 · Evaluate
      </p>
      <h1 className="mt-4 text-4xl leading-none font-bold tracking-tight text-[#171717] md:text-5xl">
        Evaluate performance
      </h1>
      <p className="mt-4 max-w-[520px] text-lg leading-relaxed text-[#66645F]">
        These numbers and charts use the held-out rows. They were not used to choose the parameters.
      </p>
      <EvaluationPanel result={result} />
      <EvaluationCharts runId={result.runId} />
    </section>
  );
}

function PredictPage() {
  const { dataset, features, trainResult } = useStudio();
  const result = trainResult as TrainResult | null;
  if (!result) return <Missing step="Train a model" to="/train" />;
  return (
    <section>
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-[#85827B] uppercase">
        <span className="size-2 rounded-full border border-[#9A927F]" />
        Step 5 · Predict
      </p>
      <h1 className="mt-4 text-4xl leading-none font-bold tracking-tight text-[#171717] md:text-5xl">
        Enter a new row
      </h1>
      <p className="mt-4 max-w-[520px] text-lg leading-relaxed text-[#66645F]">
        The saved model applies the same preparation used in training.
      </p>
      <PredictPanel runId={result.runId} features={features} dataset={dataset} />
    </section>
  );
}

function Missing({ step, to }: { step: string; to: string }) {
  return (
    <p className="rounded-xl border border-[#D8D6CF] bg-white px-4 py-6 text-sm text-[#171717]">
      {step} before this page. <NavLink to={to} className="font-semibold underline">Go back</NavLink>
    </p>
  );
}

function Decor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg className="absolute -bottom-40 -left-40 h-[520px] w-[520px] opacity-30" viewBox="0 0 520 520">
        <circle cx="180" cy="340" r="220" fill="none" stroke="#DDD9D0" strokeWidth="1.5" />
        <circle cx="80" cy="420" r="150" fill="none" stroke="#DDD9D0" strokeWidth="1" />
      </svg>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 flex min-h-20 flex-wrap items-center gap-4 border-b border-[#D8D6CF] bg-[#F7F6F2] px-6 py-3 md:px-12">
      <NavLink to="/" className="text-xl font-bold tracking-tight text-[#171717]">
        Bench
      </NavLink>
      <nav aria-label="Workflow" className="flex flex-wrap items-center gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `h-10 px-2 text-sm font-medium sm:px-3 ${isActive ? "border-b-2 border-[#171717] text-[#171717]" : "text-[#85827B]"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
