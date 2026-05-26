import { chromium, type Page } from "playwright";
import { buildLead, targetType } from "../extract.js";
import type { Layout, Lead, MailTo, Row } from "../types.js";
import {
  normalizeDate,
  normalizeEntityType,
  parseResultsTable,
  type ResultRow,
} from "./parse-results.js";

export interface RunOptions {
  layout: Layout;
  mailTo: MailTo;
  profileDir: string;
  headless: boolean;
  humanSolveTimeoutMs: number;
  keywords: string[]; // partial-word terms, e.g. ["condominium","townhome","homeowner"]
  includeInactive: boolean;
  onLead: (lead: Lead) => void;
  onSkip: (key: string, reason: string) => void;
  onStatus: (msg: string) => void;
}

const SEARCH_URL = "https://apps.ilsos.gov/businessentitysearch/";
const INACTIVE = /dissol|withdraw|revoked|terminat|cancell/i;

// Run a partial-word search and return the parsed results-table rows. Pauses (and
// prompts) if a reCAPTCHA appears so a human can clear it once per session.
async function searchPartial(
  page: Page,
  term: string,
  timeoutMs: number,
  onStatus: (m: string) => void,
): Promise<ResultRow[]> {
  await page.goto(SEARCH_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await page
    .locator("#partialWord")
    .check()
    .catch(() => {});
  await page.locator("#searchValue").fill(term);
  const btn = page.locator(
    "form#index button[type=submit], form#index input[type=submit], form#index button",
  );
  if ((await btn.count()) > 0)
    await btn
      .first()
      .click()
      .catch(() => {});
  else await page.locator("#searchValue").press("Enter");

  const deadline = Date.now() + timeoutMs;
  let prompted = false;
  for (;;) {
    await page.waitForTimeout(2000);
    const st = await page
      .evaluate(() => {
        const b = document.body?.textContent || "";
        return {
          cap: /not a robot|solve this quick test|are a person/i.test(b),
          entities: (
            b.match(/CONDOMINIUM|TOWNHOME|TOWNHOUSE|HOMEOWNER|ASSOCIATION/gi) ||
            []
          ).length,
          norec: /no records found/i.test(b),
        };
      })
      .catch(() => null);
    if (!st) continue; // mid-navigation
    if (st.cap && !prompted) {
      onStatus(
        ">>> reCAPTCHA shown — solve it in the Chrome window; I'll continue automatically.",
      );
      prompted = true;
    }
    if (!st.cap && st.norec) return [];
    if (!st.cap && st.entities >= 3) break;
    if (Date.now() > deadline) {
      onStatus(`timed out waiting for "${term}" results`);
      return [];
    }
  }
  const html = await page
    .evaluate(() => (document.querySelector("main") || document.body).innerHTML)
    .catch(() => "");
  return parseResultsTable(html);
}

function rowToLead(
  r: ResultRow,
  layout: Layout,
  mailTo: MailTo,
): { lead: Lead | null; reason?: string } {
  const master: Row = {
    fileNumber: r.fileNumber,
    entityName: r.entityName,
    entityType: normalizeEntityType(r.entityType),
    status: r.status,
    incorporationDate: normalizeDate(r.effectiveDate),
    anniversaryMonth: "",
  };
  const type = targetType(master, layout);
  if (!type)
    return { lead: null, reason: `not NFP association (${r.entityType})` };
  // Registered agent name is in the list; addresses require detail enrichment.
  const agent: Row = { agentName: r.registeredAgent };
  return { lead: buildLead(master, agent, undefined, type, mailTo) };
}

export async function scrapeIlTable(opts: RunOptions): Promise<void> {
  const context = await chromium.launchPersistentContext(opts.profileDir, {
    headless: opts.headless,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1340, height: 980 },
  });
  const seen = new Set<string>();
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    for (const term of opts.keywords) {
      opts.onStatus(`searching partial word: "${term}"`);
      const rows = await searchPartial(
        page,
        term,
        opts.humanSolveTimeoutMs,
        opts.onStatus,
      );
      opts.onStatus(`  ${rows.length} rows returned`);
      for (const r of rows) {
        if (seen.has(r.fileNumber)) continue;
        seen.add(r.fileNumber);
        if (!opts.includeInactive && INACTIVE.test(r.status)) {
          opts.onSkip(r.fileNumber, `inactive (${r.status})`);
          continue;
        }
        const { lead, reason } = rowToLead(r, opts.layout, opts.mailTo);
        if (lead) opts.onLead(lead);
        else opts.onSkip(r.fileNumber, reason ?? "filtered");
      }
    }
  } finally {
    await context.close();
  }
}
