import { readFileSync } from "node:fs";
import type { DatasetLayout, Layout, Row } from "./types.js";

export function loadLayout(path: string): Layout {
  const raw = readFileSync(path, "utf8");
  const layout = JSON.parse(raw) as Layout;
  validateLayout(layout);
  return layout;
}

function validateLayout(layout: Layout): void {
  for (const name of ["master", "agent", "annualReport"]) {
    const ds = layout.datasets[name];
    if (!ds) throw new Error(`layout: missing required dataset "${name}"`);
    if (!ds.fields.fileNumber) {
      throw new Error(
        `layout: dataset "${name}" must define a "fileNumber" field for joining`,
      );
    }
    if (!ds.source.file && !ds.source.recordType) {
      throw new Error(
        `layout: dataset "${name}" needs source.file or source.recordType`,
      );
    }
    if (ds.source.recordType && !layout.combinedFile) {
      throw new Error(
        `layout: dataset "${name}" uses recordType but no top-level combinedFile is set`,
      );
    }
  }
}

// Slice one fixed-width line into a trimmed field map. 1-based, inclusive start.
export function parseLine(line: string, ds: DatasetLayout): Row {
  const row: Row = {};
  for (const [field, [start, length]] of Object.entries(ds.fields)) {
    row[field] = line.slice(start - 1, start - 1 + length).trim();
  }
  return row;
}

// For combined files: does this line belong to the given dataset?
export function lineMatchesDataset(line: string, ds: DatasetLayout): boolean {
  const rt = ds.source.recordType;
  if (!rt) return true;
  return line.slice(rt.start - 1, rt.start - 1 + rt.length).trim() === rt.value;
}
