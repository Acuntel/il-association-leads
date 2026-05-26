import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadLayout } from "../src/layout.js";
import {
  computeStats,
  dueMonths,
  extractLeads,
  filterRefreshDue,
} from "../src/pipeline.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const layoutPath = join(root, "layouts/il.json");

function makeSampleData(): string {
  const dir = mkdtempSync(join(tmpdir(), "il-leads-"));
  execFileSync(
    "node",
    ["--import", "tsx", join(root, "scripts/make-sample.ts"), layoutPath, dir],
    {
      cwd: root,
      stdio: "pipe",
    },
  );
  return dir;
}

test("extractLeads finds only the 5 active NFP associations", async () => {
  const dir = makeSampleData();
  const layout = loadLayout(layoutPath);
  const leads = await extractLeads(dir, layout, {
    includeInactive: false,
    mailTo: "entity",
  });

  const names = leads.map((l) => l.entityName);
  assert.equal(leads.length, 5, `got: ${names.join(" | ")}`);
  // for-profit LLC, bar association, and dissolved condo must all be excluded
  assert.ok(!names.some((n) => n.includes("Management")));
  assert.ok(!names.some((n) => n.includes("Bar")));
  assert.ok(!names.some((n) => n.includes("Pinehurst")));
});

test("most-recent annual report wins the join", async () => {
  const dir = makeSampleData();
  const layout = loadLayout(layoutPath);
  const leads = await extractLeads(dir, layout, {
    includeInactive: false,
    mailTo: "entity",
  });
  const willow = leads.find((l) => l.fileNumber === "00100001");
  assert.ok(willow);
  assert.equal(willow.presidentName, "Robert Hale"); // 2025 report, not the 2019 "Old President"
});

test("--include-inactive surfaces the dissolved association", async () => {
  const dir = makeSampleData();
  const layout = loadLayout(layoutPath);
  const leads = await extractLeads(dir, layout, {
    includeInactive: true,
    mailTo: "entity",
  });
  assert.ok(leads.some((l) => l.entityName.includes("Pinehurst")));
});

test("stats counts by type", async () => {
  const dir = makeSampleData();
  const layout = loadLayout(layoutPath);
  const leads = await extractLeads(dir, layout, {
    includeInactive: false,
    mailTo: "entity",
  });
  const stats = computeStats(leads);
  assert.equal(stats.total, 5);
  assert.equal(stats.byType.condo, 1);
  assert.equal(stats.byType.townhome, 1);
  assert.equal(stats.byType.homeowner, 2); // Oakwood + Lakeside HOA
  assert.equal(stats.byType.other, 1); // Riverwoods Community
});

test("dueMonths wraps December into January", () => {
  assert.deepEqual([...dueMonths(new Date("2026-12-15"))].sort(), ["01", "12"]);
  assert.deepEqual([...dueMonths(new Date("2026-03-15"))].sort(), ["03", "04"]);
});

test("filterRefreshDue selects entities anniversary in the window", async () => {
  const dir = makeSampleData();
  const layout = loadLayout(layoutPath);
  const leads = await extractLeads(dir, layout, {
    includeInactive: false,
    mailTo: "entity",
  });
  const due = filterRefreshDue(leads, new Date("2026-03-10")); // window: 03, 04
  const names = due.map((l) => l.entityName);
  assert.deepEqual(names, ["Willow Creek Condominium Association"]); // anniversary 03
});
