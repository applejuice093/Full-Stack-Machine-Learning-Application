import { columnKind } from "@/lib/csv";
import type { TaskType } from "@/lib/models";
import { useStudio } from "@/studio/StudioContext";

const tasks: { id: TaskType; name: string; summary: string }[] = [
  {
    id: "classification",
    name: "Classification",
    summary: "Predict a group, such as sold or not sold.",
  },
  {
    id: "regression",
    name: "Regression",
    summary: "Predict a number, such as a price.",
  },
];

export function ConfigureSection() {
  const { dataset, target, features, task, prep, setPrep, setTarget, toggleFeature, setTask } = useStudio();

  return (
    <section id="configure" className="min-w-0 scroll-mt-24 border-t border-[#D8D6CF] pt-16">
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-[#85827B] uppercase">
        <span className="size-2 rounded-full border border-[#9A927F]" aria-hidden="true" />
        Step 2 · Configure
      </p>
      <h2 className="mt-4 text-4xl leading-none font-bold tracking-tight text-[#171717] md:text-5xl">Configure the table</h2>
      <p className="mt-4 max-w-[520px] text-lg leading-relaxed text-[#66645F]">
        Pick what to predict, which columns the model may see, and whether the answer is a group or a number.
      </p>

      {dataset ? (
        <div className="mt-8 grid gap-10">
          <div className="grid gap-2">
            <label htmlFor="target" className="text-sm text-foreground">
              Target column
            </label>
            <select
              id="target"
              value={target ?? ""}
              onChange={(event) => setTarget(event.target.value)}
              className="h-11 max-w-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Choose a column
              </option>
              {dataset.headers.map((header, index) => {
                const values = dataset.rows.map((row) => row[index] ?? "");
                return (
                  <option key={header} value={header}>
                    {header} ({columnKind(values)})
                  </option>
                );
              })}
            </select>
            <p className="text-card max-w-md px-3 py-2 text-sm">This is the column the model will try to predict.</p>
          </div>

          <fieldset>
            <legend className="text-sm text-foreground">Input columns</legend>
            <p className="text-card mt-2 inline-block px-3 py-2 text-sm">
              Leave out the target. Selected: {features.length}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dataset.headers.map((header) => {
                const isTarget = header === target;
                const selected = features.includes(header);
                return (
                  <button
                    key={header}
                    type="button"
                    aria-pressed={selected}
                    disabled={isTarget}
                    onClick={() => toggleFeature(header)}
                    className={`h-auto max-w-full border px-3 py-2 text-left text-sm break-words transition-[background-color,border-color,color] duration-150 ease-[var(--ease-out)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "border-[var(--mark)] bg-card text-foreground"
                        : "border-border bg-transparent text-muted-foreground"
                    }`}
                  >
                    {header}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm text-foreground">Task</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {tasks.map((item) => {
                const selected = task === item.id;
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer gap-3 border bg-card p-4 transition-[border-color] duration-150 ease-[var(--ease-out)] ${
                      selected ? "border-[var(--mark)]" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="task"
                      value={item.id}
                      checked={selected}
                      onChange={() => setTask(item.id)}
                      className="mt-1 accent-[var(--mark)]"
                    />
                    <span>
                      <span className="block text-sm text-foreground">{item.name}</span>
                      <span className="mt-1 block text-sm text-foreground">{item.summary}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="rounded-xl border border-[#D8D6CF] bg-white p-6">
            <h3 className="text-lg font-semibold text-[#171717]">Preparation</h3>
            <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-[#66645F]">
              Categories are one-hot encoded. Imputation and scaling are fitted only on the training rows.
            </p>
            <div className="mt-6 grid gap-6">
              <Choice
                label="Missing numbers"
                value={prep.numericImpute}
                options={[
                  ["median", "Median"],
                  ["mean", "Mean"],
                ]}
                onChange={(value) => setPrep({ numericImpute: value })}
              />
              <Choice
                label="Missing categories"
                value={prep.categoricalImpute}
                options={[
                  ["most_frequent", "Most common"],
                  ["constant", "Mark as missing"],
                ]}
                onChange={(value) => setPrep({ categoricalImpute: value })}
              />
              <Choice
                label="Number scale"
                value={prep.scale ? "standard" : "none"}
                options={[
                  ["standard", "Standardize"],
                  ["none", "Leave as recorded"],
                ]}
                onChange={(value) => setPrep({ scale: value === "standard" })}
              />
              <Choice
                label="Duplicate rows"
                value={prep.dropDuplicates ? "drop" : "keep"}
                options={[
                  ["drop", "Remove copies"],
                  ["keep", "Keep copies"],
                ]}
                onChange={(value) => setPrep({ dropDuplicates: value === "drop" })}
              />
              <label className="grid gap-2 text-sm text-[#171717]">
                <span className="font-medium">Hold out {Math.round(prep.testSize * 100)}% for testing</span>
                <input
                  type="range"
                  min={10}
                  max={40}
                  step={5}
                  value={Math.round(prep.testSize * 100)}
                  onChange={(event) => setPrep({ testSize: Number(event.target.value) / 100 })}
                  className="w-full max-w-md accent-[#171717]"
                />
                <span className="text-[#66645F]">The held-out rows are not used to pick parameters.</span>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-card mt-8 px-4 py-6 text-sm">
          Upload a CSV before choosing columns.
        </p>
      )}
    </section>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#171717]">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([option, name]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`h-10 border px-3 text-sm transition-colors duration-150 ease-out ${
              value === option
                ? "border-[#9A927F] bg-[#F7F6F2] text-[#171717]"
                : "border-[#D8D6CF] bg-white text-[#66645F]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
