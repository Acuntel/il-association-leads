// Live scraper entry point. Drives a real Chromium through the IL SOS search,
// streams Leads to a crash-safe JSONL checkpoint, and writes a final CSV.
//
// MUST run on a machine with a residential IP and a real browser:
//   npm run scrape:setup           # one-time: download Chromium
//   npm run scrape -- --out output/leads.csv [--headless] [--max 50] [--min-delay 3000] [--max-delay 7000]
//
// apps.ilsos.gov is behind an Akamai-class WAF. Run headed (default) the first
// time, and if a bot challenge appears, solve it once in the opened window — the
// persistent profile keeps you cleared. Keep delays high; if you start getting
// blocked, raise them rather than hammering.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { loadLayout } from "../src/layout.js";
import { leadsToCsv } from "../src/output.js";
import { scrapeIl } from "../src/scrape/ilsos.js";
import type { Lead, MailTo } from "../src/types.js";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const out = flag("out", "output/leads.csv");
  const checkpoint = out.replace(/\.csv$/, "") + ".jsonl";
  const layout = loadLayout(flag("layout", "layouts/il.json"));
  const mailTo: MailTo =
    flag("mail-to", "entity") === "officer" ? "officer" : "entity";

  mkdirSync(dirname(out), { recursive: true });

  // Resume: reload any leads already captured in a prior run.
  const leads: Lead[] = [];
  const resumeKeys: string[] = [];
  if (existsSync(checkpoint)) {
    for (const line of readFileSync(checkpoint, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const lead = JSON.parse(line) as Lead;
      leads.push(lead);
      resumeKeys.push(lead.fileNumber);
    }
    process.stdout.write(`Resuming: ${leads.length} leads already captured.\n`);
  }

  await scrapeIl({
    layout,
    mailTo,
    profileDir: flag("profile", ".chromium-profile"),
    headless: has("headless"),
    minDelayMs: parseInt(flag("min-delay", "3000"), 10),
    maxDelayMs: parseInt(flag("max-delay", "7000"), 10),
    keywords: [],
    maxPerKeyword: parseInt(flag("max", "0"), 10),
    humanSolveTimeoutMs: parseInt(flag("solve-timeout", "300000"), 10),
    resumeKeys,
    onLead: (lead) => {
      leads.push(lead);
      appendFileSync(checkpoint, JSON.stringify(lead) + "\n"); // crash-safe
      process.stdout.write(`  + ${lead.entityName} (${lead.fileNumber})\n`);
    },
    onSkip: (key, reason) =>
      process.stdout.write(`  - skip ${key}: ${reason}\n`),
  });

  writeFileSync(out, leadsToCsv(leads), "utf8");
  process.stdout.write(`\nWrote ${leads.length} leads -> ${out}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
