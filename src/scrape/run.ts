import { chromium, type Page } from "playwright";
import { buildLead, targetType } from "../extract.js";
import type { Layout, Lead, MailTo, Row } from "../types.js";
import {
  normalizeDate,
  normalizeEntityType,
  parseResultsTable,
  type ResultRow,
} from "./parse-results.js";
import { parseDetailText, type EntityDetail } from "./parse-detail.js";

export interface RunOptions {
  layout: Layout;
  mailTo: MailTo;
  profileDir: string;
  headless: boolean;
  humanSolveTimeoutMs: number; // only for the search step (waiting on a human captcha solve)
  detailTimeoutMs: number; // per-detail-page wait; short so a bad click can't hang the run
  keywords: string[]; // partial-word terms, e.g. ["condominium","townhome","homeowner"]
  includeInactive: boolean;
  enrich: boolean; // click each entity to pull Principal Address + agent/officers
  maxPerKeyword: number; // 0 = all
  onLead: (lead: Lead) => void;
  onSkip: (key: string, reason: string) => void;
  onStatus: (msg: string) => void;
}

const SEARCH_URL = "https://apps.ilsos.gov/businessentitysearch/";
const INACTIVE = /dissol|withdraw|revoked|terminat|cancell/i;
const ENTITY_LINK = "a[href='#getDetails']";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Partial-word search; returns the results-table rows. Pauses (and prompts) if a
// reCAPTCHA appears so a human can clear it once per session. Leaves the page on results.
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

// Click the n-th result, scrape the detail page, then go back to the results list.
async function enrichDetail(
  page: Page,
  index: number,
  detailTimeoutMs: number,
  humanSolveTimeoutMs: number,
  onStatus: (m: string) => void,
): Promise<EntityDetail | null> {
  const links = page.locator(ENTITY_LINK);
  if (index >= (await links.count())) return null;
  await links
    .nth(index)
    .click()
    .catch(() => {});

  let deadline = Date.now() + detailTimeoutMs;
  let prompted = false;
  for (;;) {
    await page.waitForTimeout(700);
    const st = await page
      .evaluate(() => {
        const t = document.body?.innerText || "";
        return {
          ready: t.includes("Principal Address"),
          cap: /not a robot|solve this quick test|are a person/i.test(t),
        };
      })
      .catch(() => null);
    if (st?.ready) break;
    if (st?.cap && !prompted) {
      onStatus(
        ">>> reCAPTCHA on a detail page — solve it in the window; continuing after.",
      );
      prompted = true;
      deadline = Date.now() + humanSolveTimeoutMs; // give the human time to solve
    }
    if (Date.now() > deadline) break;
  }
  const text = await page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  const detail = text.includes("Principal Address")
    ? parseDetailText(text)
    : null;
  if (!detail) {
    onStatus(
      `    [debug] click ${index}: url=${page.url().slice(-50)} snippet="${text.replace(/\s+/g, " ").slice(0, 160)}"`,
    );
  }

  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  const back = Date.now() + 15000;
  for (;;) {
    await page.waitForTimeout(500);
    if (
      (await page
        .locator(ENTITY_LINK)
        .count()
        .catch(() => 0)) > 0
    )
      break;
    if (Date.now() > back) break;
  }
  return detail;
}

function rowToLead(
  r: ResultRow,
  layout: Layout,
  mailTo: MailTo,
  detail?: EntityDetail | null,
): { lead: Lead | null; reason?: string } {
  const master: Row = {
    fileNumber: r.fileNumber,
    entityName: r.entityName,
    entityType: normalizeEntityType(r.entityType),
    status: r.status,
    incorporationDate: normalizeDate(r.effectiveDate),
    anniversaryMonth: "",
  };
  if (detail) {
    master.entityStreet = detail.principal.street;
    master.entityCity = detail.principal.city;
    master.entityState = detail.principal.state;
    master.entityZip = detail.principal.zip;
  }
  const type = targetType(master, layout);
  if (!type)
    return { lead: null, reason: `not NFP association (${r.entityType})` };

  const agent: Row = detail
    ? {
        agentName: detail.agentName || r.registeredAgent,
        agentStreet: detail.agent.street,
        agentCity: detail.agent.city,
        agentState: detail.agent.state,
        agentZip: detail.agent.zip,
      }
    : { agentName: r.registeredAgent };
  const annual: Row | undefined = detail
    ? {
        presidentName: detail.presidentName,
        presidentStreet: detail.president.street,
        presidentCity: detail.president.city,
        presidentState: detail.president.state,
        presidentZip: detail.president.zip,
        secretaryName: detail.secretaryName,
        secretaryStreet: detail.secretary.street,
        secretaryCity: detail.secretary.city,
        secretaryState: detail.secretary.state,
        secretaryZip: detail.secretary.zip,
      }
    : undefined;
  return { lead: buildLead(master, agent, annual, type, mailTo) };
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
      let kept = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        if (seen.has(r.fileNumber)) continue;
        seen.add(r.fileNumber);
        if (!opts.includeInactive && INACTIVE.test(r.status)) {
          opts.onSkip(r.fileNumber, `inactive (${r.status})`);
          continue;
        }
        if (rowToLead(r, opts.layout, opts.mailTo).lead === null) {
          opts.onSkip(r.fileNumber, `not NFP association (${r.entityType})`);
          continue;
        }
        if (opts.maxPerKeyword && kept >= opts.maxPerKeyword) continue;
        let detail: EntityDetail | null = null;
        if (opts.enrich) {
          detail = await enrichDetail(
            page,
            i,
            opts.detailTimeoutMs,
            opts.humanSolveTimeoutMs,
            opts.onStatus,
          );
          if (!detail)
            opts.onStatus(
              `  (no detail for ${r.fileNumber}; keeping list-level data)`,
            );
          await sleep(900); // polite pace between detail views
        }
        const { lead } = rowToLead(r, opts.layout, opts.mailTo, detail);
        if (lead) {
          opts.onLead(lead);
          kept++;
        }
      }
    }
  } finally {
    await context.close();
  }
}
