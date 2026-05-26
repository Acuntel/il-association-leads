import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { lineMatchesDataset, parseLine } from "./layout.js";
import type { Layout, Row } from "./types.js";

// Resolve the file that holds a dataset's records (dedicated file, or the
// shared combined file). Throws a clear error if it is missing.
export function datasetPath(
  rootDir: string,
  layout: Layout,
  datasetName: string,
): string {
  const ds = layout.datasets[datasetName];
  if (!ds) throw new Error(`unknown dataset "${datasetName}"`);
  const file = ds.source.file ?? layout.combinedFile;
  if (!file)
    throw new Error(`dataset "${datasetName}" has no file and no combinedFile`);
  const path = join(rootDir, file);
  if (!existsSync(path)) {
    throw new Error(
      `data file not found: ${path} (for dataset "${datasetName}")`,
    );
  }
  return path;
}

// Stream a dataset's rows line-by-line. Skips blank lines and (for combined
// files) lines whose record-type does not match the dataset.
export async function* streamRows(
  rootDir: string,
  layout: Layout,
  datasetName: string,
): AsyncGenerator<Row> {
  const ds = layout.datasets[datasetName]!;
  const path = datasetPath(rootDir, layout, datasetName);
  const rl = createInterface({
    input: createReadStream(path, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    if (!lineMatchesDataset(line, ds)) continue;
    yield parseLine(line, ds);
  }
}
