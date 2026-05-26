import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeDate,
  normalizeEntityType,
  parseResultsTable,
} from "../src/scrape/parse-results.js";

// Fixture: real row shapes captured from the live IL SOS results table (2026-05).
const HTML = `
<table id="sortTable">
<tr role="row"><th>File Number</th><th>Entity Type</th><th>Entity Name</th><th>Entity Status</th><th>Effective Date</th><th>Registered Agent</th></tr>
<tr role="row" class="odd"> <td class="sorting_1">00223476</td> <td>LLC (MST)</td> <td id="678541055"><a href="#getDetails">ARLINGTON SQUARE CONDOMINIUM VENTURE, L.L.C.</a></td> <td>INVOLUNTARY DISSOLUTION</td> <td>09-16-1998</td> <td>DAVID GLICKSTEIN</td> </tr>
<tr role="row" class="even"> <td class="sorting_1">55512345</td> <td>NFP (MST)</td> <td id="678541083"><a href="#getDetails">ABBEYWOOD CONDOMINIUM ASSOCIATION</a></td> <td>GOOD STANDING</td> <td>03-12-1998</td> <td>JANE MILLER</td> </tr>
</table>`;

test("parseResultsTable extracts six-column data rows, skipping the header", () => {
  const rows = parseResultsTable(HTML);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], {
    fileNumber: "55512345",
    entityType: "NFP (MST)",
    entityName: "ABBEYWOOD CONDOMINIUM ASSOCIATION",
    status: "GOOD STANDING",
    effectiveDate: "03-12-1998",
    registeredAgent: "JANE MILLER",
  });
});

test("normalizeEntityType reduces '(MST)/(OLD)' variants to the base code", () => {
  assert.equal(normalizeEntityType("NFP (MST)"), "NFP");
  assert.equal(normalizeEntityType("NFP (OLD)"), "NFP");
  assert.equal(normalizeEntityType("LLC (MST)"), "LLC");
});

test("normalizeDate converts MM-DD-YYYY to YYYYMMDD", () => {
  assert.equal(normalizeDate("03-12-1998"), "19980312");
  assert.equal(normalizeDate("09-16-1998"), "19980916");
  assert.equal(normalizeDate(""), "");
});
