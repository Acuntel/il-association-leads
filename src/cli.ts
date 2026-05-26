#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadLayout } from "./layout.js";
import { leadsToCsv, leadsToJson } from "./output.js";
import {
  computeStats,
  extractLeads,
  filterRefreshDue,
  type PipelineOptions,
} from "./pipeline.js";
import type { MailTo } from "./types.js";

interface Args {
  command: string;
  flags: Record<string, string>;
  bools: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i]!;
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      bools.add(key);
    } else {
      flags[key] = next;
      i++;
    }
  }
  return { command, flags, bools };
}

const HELP = `il-association-leads — extract IL condo/townhome/homeowner association leads
from the official IL SOS bulk data file (no scraping).

Usage:
  leads extract --input <dir> --layout <file> --out <file.csv> [--include-inactive] [--json] [--mail-to entity|officer]
  leads refresh-due --input <dir> --layout <file> [--out <file.csv>]
  leads stats --input <dir> --layout <file>

Defaults: --layout layouts/il.json, --mail-to entity.
`;

function getLayoutPath(flags: Record<string, string>): string {
  return flags.layout ?? "layouts/il.json";
}

function requireInput(flags: Record<string, string>): string {
  if (!flags.input) {
    throw new Error(
      "--input <dir> is required (directory holding the SOS data files)",
    );
  }
  return flags.input;
}

function writeOut(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

async function run(): Promise<void> {
  const { command, flags, bools } = parseArgs(process.argv.slice(2));

  if (command === "help" || bools.has("help")) {
    process.stdout.write(HELP);
    return;
  }

  const layout = loadLayout(getLayoutPath(flags));
  const input = requireInput(flags);
  const mailTo: MailTo = flags["mail-to"] === "officer" ? "officer" : "entity";
  const opts: PipelineOptions = {
    includeInactive: bools.has("include-inactive"),
    mailTo,
  };

  if (command === "extract") {
    const leads = await extractLeads(input, layout, opts);
    const out = flags.out ?? "output/leads.csv";
    writeOut(out, leadsToCsv(leads));
    if (bools.has("json"))
      writeOut(out.replace(/\.csv$/, "") + ".json", leadsToJson(leads));
    process.stdout.write(`Wrote ${leads.length} leads -> ${out}\n`);
    return;
  }

  if (command === "refresh-due") {
    const leads = await extractLeads(input, layout, opts);
    const due = filterRefreshDue(leads, new Date());
    if (flags.out) writeOut(flags.out, leadsToCsv(due));
    process.stdout.write(
      `${due.length} associations due to re-file this/next month:\n`,
    );
    for (const l of due) {
      process.stdout.write(
        `  [${l.anniversaryMonth}] ${l.entityName} (${l.fileNumber})\n`,
      );
    }
    return;
  }

  if (command === "stats") {
    const leads = await extractLeads(input, layout, opts);
    const stats = computeStats(leads);
    process.stdout.write(JSON.stringify(stats, null, 2) + "\n");
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}

run().catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
