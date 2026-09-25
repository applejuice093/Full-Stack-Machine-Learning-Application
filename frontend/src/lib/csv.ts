export type ColumnKind = "number" | "text";

export type ColumnSchema = {
  name: string;
  inferredType: string;
  missingCount: number;
  uniqueCount: number;
};

export type ParsedDataset = {
  name: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  datasetId?: string;
  sourceFormat?: string;
  schema?: ColumnSchema[];
  targetHint?: string | null;
  candidates?: string[];
  selectedMember?: string | null;
};

const MAX_BYTES = 8 * 1024 * 1024;

export function readCsvFile(file: File): Promise<ParsedDataset> {
  const name = file.name.trim();
  const looksLikeCsv =
    name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (!looksLikeCsv) {
    return Promise.reject(
      new Error("Upload a .csv file. Other spreadsheet formats need to be exported as CSV first."),
    );
  }

  if (file.size === 0) {
    return Promise.reject(new Error("This file is empty."));
  }

  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error("This file is larger than 8 MB. Use a smaller CSV."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseCsv(String(reader.result ?? ""), name));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("This CSV could not be read."));
      }
    };
    reader.onerror = () => reject(new Error("This CSV could not be read."));
    reader.readAsText(file);
  });
}

export function parseCsv(text: string, filename: string): ParsedDataset {
  const table = parseTable(text).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (table.length < 2) {
    throw new Error("The file needs a header row and at least one data row.");
  }

  const headers = table[0].map((cell) => cell.trim());

  if (headers.some((header) => header === "")) {
    throw new Error("Every column needs a name in the first row.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("Column names must be unique.");
  }

  const rows = table.slice(1).map((row) => headers.map((_, index) => (row[index] ?? "").trim()));

  return {
    name: filename,
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

export function columnKind(values: string[]): ColumnKind {
  const present = values.filter((value) => value !== "");
  if (present.length === 0) return "text";
  return present.every((value) => /^-?\d+(\.\d+)?$/.test(value)) ? "number" : "text";
}

export function missingCount(values: string[]): number {
  return values.filter((value) => value === "").length;
}

function parseTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
