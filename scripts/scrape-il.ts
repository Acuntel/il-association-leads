// Live scraper entry point. Drives real Chrome through the IL SOS business entity
// search, parses the results table, and writes a CSV (+ crash-safe JSONL checkpoint).
//
//   npm run scrape:setup      # one-time: download Chromium (or rely on installed Chrome)
//   npm run scrape -- --out output/leads.csv [--headless] [--include-inactive]
//                     [--keywords "condominium,townhome,townhouse,homeowner"]
//
// Notes (all verified live, 2026-05):
//  - apps.ilsos.gov blocks headless browsers, so we launch real Chrome headed.
//  - The search uses the "Partial Word" method (matches a word anywhere in the name);
//    "Keyword" only matches name prefixes and misses mid-name phrases.
//  - The first search may show a reCAPTCHA; solve it once in the window and the
//    persistent profile stays cleared for the rest of the run.
//  - IL caps each search at 100 rows, so we sweep several partial words and dedupe.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { loadLayout } from "../src/layout.js";
import { leadsToCsv, leadsToJson } from "../src/output.js";
import { scrapeIlTable } from "../src/scrape/run.js";
import type { Lead, MailTo } from "../src/types.js";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const DEFAULT_KEYWORDS = [
  "condominium",
  "townhome",
  "townhouse",
  "homeowner",
  "owners",
];

async function main(): Promise<void> {
  const out = flag("out", "output/leads.csv");
  const checkpoint = out.replace(/\.csv$/, "") + ".jsonl";
  const layout = loadLayout(flag("layout", "layouts/il.json"));
  const mailTo: MailTo =
    flag("mail-to", "entity") === "officer" ? "officer" : "entity";
  const keywords = flag("keywords", DEFAULT_KEYWORDS.join(","))
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  mkdirSync(dirname(out), { recursive: true });

  const leads: Lead[] = [];
  const seen = new Set<string>();
  if (existsSync(checkpoint)) {
    for (const line of readFileSync(checkpoint, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const lead = JSON.parse(line) as Lead;
      if (seen.has(lead.fileNumber)) continue;
      seen.add(lead.fileNumber);
      leads.push(lead);
    }
    process.stdout.write(`Resuming: ${leads.length} leads already captured.\n`);
  }

  await scrapeIlTable({
    layout,
    mailTo,
    profileDir: flag("profile", ".chromium-profile"),
    headless: has("headless"),
    humanSolveTimeoutMs: parseInt(flag("solve-timeout", "300000"), 10),
    detailTimeoutMs: parseInt(flag("detail-timeout", "25000"), 10),
    keywords,
    includeInactive: has("include-inactive"),
    enrich: !has("no-enrich"),
    maxPerKeyword: parseInt(flag("max", "0"), 10),
    onLead: (lead) => {
      if (seen.has(lead.fileNumber)) return;
      seen.add(lead.fileNumber);
      leads.push(lead);
      appendFileSync(checkpoint, JSON.stringify(lead) + "\n");
      process.stdout.write(`  + ${lead.entityName} (${lead.fileNumber})\n`);
    },
    onSkip: (key, reason) =>
      process.stdout.write(`  - skip ${key}: ${reason}\n`),
    onStatus: (msg) => process.stdout.write(`${msg}\n`),
  });

  writeFileSync(out, leadsToCsv(leads), "utf8");
  writeFileSync(
    out.replace(/\.csv$/, "") + ".json",
    leadsToJson(leads),
    "utf8",
  );
  process.stdout.write(`\nWrote ${leads.length} leads -> ${out}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
