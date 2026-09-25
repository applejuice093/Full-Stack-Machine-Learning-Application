import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Columns3, File, FileSpreadsheet, Table2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columnKind, missingCount, type ColumnSchema } from "@/lib/csv";
import { useStudio } from "@/studio/StudioContext";
import { CountValue } from "./CountValue";

const SAMPLE_LIMIT = 6;

export function UploadSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dataset, error, reading, loadFile, loadSample, clearDataset, sourceFile } = useStudio();
  const [dragging, setDragging] = useState(false);

  function takeFile(file: File | null) {
    if (file) void loadFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    takeFile(event.dataTransfer.files.item(0));
  }

  return (
    <section id="upload" className="min-w-0 scroll-mt-24">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="max-w-[520px]">
          <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-[#85827B] uppercase">
            <span className="size-2 rounded-full border border-[#9A927F]" aria-hidden="true" />
            Step 1 · Upload
          </p>
          <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-bold tracking-[-0.03em] text-[#171717] sm:text-6xl lg:text-[4.25rem]">
            Upload a CSV
          </h1>
          <p className="mt-6 max-w-[500px] text-lg leading-relaxed text-[#66645F] sm:text-xl">
            Bring in a table with a header row. The next two steps use those columns.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadSample}
              disabled={reading}
              className="inline-flex h-14 items-center gap-2 rounded-lg bg-[#171717] px-5 text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] disabled:opacity-50"
            >
              <File className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Use sample table
            </button>
            <button
              type="button"
              onClick={clearDataset}
              disabled={!dataset}
              className="inline-flex h-14 items-center gap-2 rounded-lg border border-[#D8D6CF] bg-transparent px-5 text-sm font-medium text-[#171717] transition-colors duration-200 ease-out hover:bg-[#ECEAE4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Remove file
            </button>
          </div>
          {error || reading ? (
            <p className="mt-4 text-sm text-[#7A3E32]" role="alert">
              {error ?? "Reading the file."}
            </p>
          ) : null}
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-[320px] w-full flex-col rounded-xl border bg-white p-4 transition-[border-color,background-color] duration-200 ease-out lg:min-h-[420px] lg:max-w-[560px] lg:justify-self-end ${
            dragging ? "border-[#9A927F] bg-[#F1EFE9]" : "border-[#D8D6CF]"
          }`}
        >
          <div
            className={`flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center ${
              dragging ? "border-[#9A927F]" : "border-[#C9C6BE]"
            }`}
          >
            <FileSpreadsheet className="size-8 text-[#171717]" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-6 text-[1.35rem] font-semibold text-[#171717]">Drop a CSV file here</p>
            <p className="mt-2 text-sm text-[#85827B]">or browse from your device</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-[#171717] px-6 text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
            >
              Browse files
            </button>
            <p className="mt-6 text-xs text-[#85827B]">
              CSV, Excel, ARFF, JSON, Parquet and other ML formats
            </p>
            <details className="mt-2 text-xs text-[#85827B]">
              <summary className="cursor-pointer">View supported formats</summary>
              <p className="mt-2 max-w-sm leading-relaxed">
                CSV, TSV, TXT, DAT, XLSX, XLS, XLSM, ARFF, LIBSVM, JSON, JSONL, Parquet,
                Feather, Arrow, NPY, NPZ, HDF5, MAT, XML, YAML, SAV, DTA, SAS, XPT. Up to 8 MB.
              </p>
            </details>
            <input
              ref={inputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose a CSV file"
              className="sr-only"
              onChange={(event) => {
                takeFile(event.target.files?.item(0) ?? null);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      {dataset ? (
        <div className="mt-16 min-w-0">
          <div className="grid overflow-hidden rounded-xl border border-[#D8D6CF] bg-white sm:grid-cols-3">
            <Stat icon={<File className="size-4" strokeWidth={1.75} />} label="File" value={dataset.name} />
            <Stat
              icon={<Table2 className="size-4" strokeWidth={1.75} />}
              label="Rows"
              value={<CountValue value={dataset.rowCount} />}
            />
            <Stat
              icon={<Columns3 className="size-4" strokeWidth={1.75} />}
              label="Columns"
              value={<CountValue value={dataset.columnCount} />}
            />
          </div>

          <div className="mt-12 min-w-0">
            <h2 className="text-lg font-semibold text-[#171717]">Columns</h2>
            {(dataset.candidates?.length ?? 0) > 1 && sourceFile ? (
              <label className="mt-4 flex max-w-md flex-col gap-2 text-sm text-[#171717]">
                Also in this file
                <select
                  value={dataset.selectedMember ?? dataset.candidates?.[0] ?? ""}
                  onChange={(event) => {
                    if (sourceFile) void loadFile(sourceFile, event.target.value);
                  }}
                  className="h-11 rounded-lg border border-[#D8D6CF] bg-white px-3"
                >
                  {dataset.candidates?.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ul className="mt-4 flex min-w-0 flex-wrap gap-2">
              {dataset.headers.map((header, index) => {
                const values = dataset.rows.map((row) => row[index] ?? "");
                const stored = dataset.schema?.find((column) => column.name === header);
                const description = stored
                  ? describeColumn(stored)
                  : `${columnKind(values) === "number" ? "number" : "text"}${
                      missingCount(values) > 0 ? `, ${missingCount(values)} empty` : ""
                    }`;
                return (
                  <li
                    key={header}
                    className="max-w-full rounded-lg border border-[#D8D6CF] bg-white px-3 py-2 text-sm break-words"
                  >
                    <span className="font-medium text-[#171717]">{header}</span>
                    <span className="mt-1 block text-[#66645F]">{description}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-12 min-w-0">
            <h2 className="text-lg font-semibold text-[#171717]">Sample rows</h2>
            <p className="mt-2 text-sm text-[#66645F]">
              Showing {Math.min(SAMPLE_LIMIT, dataset.rowCount)} of {dataset.rowCount}.
            </p>
            <div className="mt-4 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#D8D6CF] bg-white">
              <Table className="w-max">
                <TableHeader>
                  <TableRow>
                    {dataset.headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.rows.slice(0, SAMPLE_LIMIT).map((row, rowIndex) => (
                    <TableRow key={`${dataset.name}-${rowIndex}`}>
                      {dataset.headers.map((header, columnIndex) => (
                        <TableCell key={header}>{row[columnIndex] || "empty"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function describeColumn(column: ColumnSchema): string {
  const empty = column.missingCount > 0 ? `, ${column.missingCount} empty` : "";
  return `${column.inferredType}${empty}`;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-[#D8D6CF] px-6 py-6 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1EFE9] text-[#171717]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#85827B] uppercase">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-[#171717]">{value}</p>
      </div>
    </div>
  );
}
