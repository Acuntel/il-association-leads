import assert from "node:assert/strict";
import { test } from "node:test";
import { lineMatchesDataset, parseLine } from "../src/layout.js";
import type { DatasetLayout } from "../src/types.js";

const ds: DatasetLayout = {
  source: { file: "x.txt" },
  fields: {
    fileNumber: [1, 8],
    name: [9, 10],
    state: [19, 2],
  },
};

test("parseLine slices fixed-width fields and trims", () => {
  //            12345678 9012345678 90
  const line = "00100001ACME CORP IL";
  const row = parseLine(line, ds);
  assert.equal(row.fileNumber, "00100001");
  assert.equal(row.name, "ACME CORP");
  assert.equal(row.state, "IL");
});

test("parseLine tolerates short lines (missing trailing fields)", () => {
  const row = parseLine("00100002", ds);
  assert.equal(row.fileNumber, "00100002");
  assert.equal(row.name, "");
  assert.equal(row.state, "");
});

test("lineMatchesDataset filters combined-file records by record type", () => {
  const combined: DatasetLayout = {
    source: { recordType: { start: 1, length: 1, value: "M" } },
    fields: { fileNumber: [2, 8] },
  };
  assert.equal(lineMatchesDataset("M00100001", combined), true);
  assert.equal(lineMatchesDataset("A00100001", combined), false);
  // No recordType configured -> every line matches.
  assert.equal(lineMatchesDataset("anything", ds), true);
});
