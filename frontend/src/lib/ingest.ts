import { parseCsv, readCsvFile, type ParsedDataset } from "@/lib/csv";

const MAX_BYTES = 8 * 1024 * 1024;

type ParseResponse = {
  filename: string;
  datasetId?: string;
  sourceFormat: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  schema: ParsedDataset["schema"];
  targetColumn: string | null;
  metadata?: {
    candidates?: string[];
    selectedMember?: string | null;
  };
  detail?: string;
};

const LABEL_FORMATS = new Set(["arff", "libsvm"]);

class ParserRejected extends Error {}

export async function readDataset(file: File, member?: string): Promise<ParsedDataset> {
  if (file.size === 0) {
    throw new Error("This file is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("This file is larger than 8 MB. Use a smaller file.");
  }

  const remote = await readFromServices(file, member);
  if (remote) return remote;

  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return rememberDataset(await readCsvFile(file));
  }
  throw new Error("Start the ML service to read this format. CSV files can still be read in the browser.");
}

async function readFromServices(file: File, member?: string): Promise<ParsedDataset | null> {
  const endpoints = ["/datasets/parse", "/dataset/parse"];
  let unreachable = true;

  for (const endpoint of endpoints) {
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      if (member) form.append("member", member);
      const response = await fetch(endpoint, { method: "POST", body: form });
      unreachable = false;
      const body = (await response.json()) as ParseResponse;
      if (!response.ok) {
        const message = typeof body.detail === "string" ? body.detail : "This file could not be read.";
        if (response.status < 500) throw new ParserRejected(message);
        continue;
      }
      return {
        name: body.filename,
        datasetId: body.datasetId,
        headers: body.headers,
        rows: body.rows,
        rowCount: body.rowCount,
        columnCount: body.columnCount,
        sourceFormat: body.sourceFormat,
        schema: body.schema,
        targetHint: LABEL_FORMATS.has(body.sourceFormat) ? body.targetColumn : null,
        candidates: body.metadata?.candidates ?? [],
        selectedMember: body.metadata?.selectedMember ?? null,
      };
    } catch (error) {
      if (error instanceof ParserRejected) throw error;
    }
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return null;
  }
  if (unreachable) {
    throw new Error(
      "The dataset service is not running, so this format cannot be read yet. CSV files still load in the browser. Start the service with npm run dev:ml.",
    );
  }
  throw new Error("This file could not be read.");
}

export async function rememberDataset(dataset: ParsedDataset): Promise<ParsedDataset> {
  try {
    const response = await fetch("/datasets/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: dataset.name,
        headers: dataset.headers,
        rows: dataset.rows,
      }),
    });
    if (!response.ok) return dataset;
    const body = (await response.json()) as { datasetId?: string };
    return body.datasetId ? { ...dataset, datasetId: body.datasetId } : dataset;
  } catch {
    return dataset;
  }
}

export function parseSampleCsv(text: string, filename: string): ParsedDataset {
  return parseCsv(text, filename);
}
