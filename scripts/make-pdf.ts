// Render a leads file (.json array, .jsonl checkpoint, or .csv) into a print-ready
// PDF directory using the already-installed Chromium.
//   npm run pdf -- --in output/leads.json --out output/leads.pdf [--title "..."] [--source "..."] [--sample]
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { leadsToHtml } from "../src/pdf.js";
import type { Lead } from "../src/types.js";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

function loadLeads(path: string): Lead[] {
  if (!existsSync(path)) throw new Error(`leads file not found: ${path}`);
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".jsonl")) {
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Lead);
  }
  if (path.endsWith(".json")) return JSON.parse(raw) as Lead[];
  // minimal CSV reader (handles quoted cells)
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o as unknown as Lead;
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

async function main(): Promise<void> {
  const inPath = flag("in", "output/leads.json");
  const outPath = flag("out", "output/leads.pdf");
  const sample = has("sample");
  const leads = loadLeads(inPath);

  const html = leadsToHtml(leads, {
    title: flag("title", "Illinois Community Association Mailing List"),
    sourceNote: flag(
      "source",
      sample ? "SAMPLE generated data" : "Source: Illinois Secretary of State",
    ),
    sample,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outPath,
    printBackground: true,
    landscape: true,
    format: "Letter",
  });
  await browser.close();
  process.stdout.write(`Wrote ${leads.length}-lead PDF -> ${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
