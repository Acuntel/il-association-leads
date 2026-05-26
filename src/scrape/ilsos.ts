import { chromium, type BrowserContext, type Page } from "playwright";
import type { Lead, Layout, MailTo } from "../types.js";
import { scrapedToLead, type ScrapedEntity } from "./adapt.js";
import { ASSOCIATION_KEYWORDS, IL, type SiteConfig } from "./selectors.js";

export interface ScrapeOptions {
  layout: Layout;
  mailTo: MailTo;
  profileDir: string; // persistent Chromium profile (helps pass bot checks)
  headless: boolean;
  minDelayMs: number; // polite throttle floor between requests
  maxDelayMs: number; // throttle ceiling (jitter picks within [min,max])
  keywords: string[];
  maxPerKeyword: number; // 0 = no cap
  resumeKeys?: string[]; // file numbers already done in a prior run (skip them)
  onLead: (lead: Lead) => void; // stream results out (so a crash keeps progress)
  onSkip: (fileNumber: string, reason: string) => void;
}

const jitter = (min: number, max: number) =>
  min + Math.floor(Math.random() * Math.max(0, max - min));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textOf(page: Page, selector: string): Promise<string> {
  try {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) return "";
    return ((await el.textContent()) ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function scrapeDetail(
  page: Page,
  cfg: SiteConfig,
): Promise<ScrapedEntity> {
  const d = cfg.detail;
  if (d.officerTab) {
    const tab = page.locator(d.officerTab).first();
    if ((await tab.count()) > 0) {
      await tab.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }
  return {
    fileNumber: await textOf(page, d.fileNumber),
    entityName: await textOf(page, d.entityName),
    entityType: await textOf(page, d.entityType),
    status: await textOf(page, d.status),
    incorporationDate: await textOf(page, d.incorporationDate),
    agentName: await textOf(page, d.agentName),
    agentAddress: await textOf(page, d.agentAddress),
    presidentName: await textOf(page, d.presidentName),
    presidentAddress: await textOf(page, d.presidentAddress),
    secretaryName: await textOf(page, d.secretaryName),
    secretaryAddress: await textOf(page, d.secretaryAddress),
  };
}

async function searchKeyword(
  context: BrowserContext,
  cfg: SiteConfig,
  keyword: string,
  opts: ScrapeOptions,
  seen: Set<string>,
): Promise<void> {
  const page = await context.newPage();
  await page.goto(cfg.searchUrl, { waitUntil: "domcontentloaded" });
  if (cfg.searchTypeNameRadio) {
    await page
      .locator(cfg.searchTypeNameRadio)
      .first()
      .check()
      .catch(() => {});
  }
  await page.locator(cfg.searchInput).first().fill(keyword);
  await page.locator(cfg.searchSubmit).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});

  let collected = 0;
  for (;;) {
    const links = page.locator(`${cfg.resultRow} ${cfg.resultLink}`);
    const hrefs = (await links.evaluateAll((els) =>
      els
        .map((e) => (e as unknown as { href?: string }).href ?? "")
        .filter(Boolean),
    )) as string[];

    for (const href of hrefs) {
      if (opts.maxPerKeyword && collected >= opts.maxPerKeyword) break;
      const detail = await context.newPage();
      try {
        await detail.goto(href, { waitUntil: "domcontentloaded" });
        const entity = await scrapeDetail(detail, cfg);
        const key = entity.fileNumber || href;
        if (!seen.has(key)) {
          seen.add(key);
          const lead = scrapedToLead(entity, opts.layout, opts.mailTo);
          if (lead) opts.onLead(lead);
          else opts.onSkip(key, "not a target NFP association");
          collected++;
        }
      } catch (err) {
        opts.onSkip(href, err instanceof Error ? err.message : String(err));
      } finally {
        await detail.close();
        await sleep(jitter(opts.minDelayMs, opts.maxDelayMs)); // polite throttle
      }
    }

    if (opts.maxPerKeyword && collected >= opts.maxPerKeyword) break;
    const next = cfg.nextPage ? page.locator(cfg.nextPage).first() : null;
    if (
      !next ||
      (await next.count()) === 0 ||
      !(await next.isEnabled().catch(() => false))
    )
      break;
    await next.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(jitter(opts.minDelayMs, opts.maxDelayMs));
  }
  await page.close();
}

// Drive a real Chromium through the live search, one keyword at a time, politely
// throttled. Streams each Lead out via opts.onLead so a mid-run block loses nothing.
export async function scrapeIl(opts: ScrapeOptions): Promise<void> {
  const cfg = IL;
  const context = await chromium.launchPersistentContext(opts.profileDir, {
    headless: opts.headless,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const seen = new Set<string>(opts.resumeKeys ?? []);
  try {
    for (const keyword of opts.keywords.length
      ? opts.keywords
      : ASSOCIATION_KEYWORDS) {
      await searchKeyword(context, cfg, keyword, opts, seen);
    }
  } finally {
    await context.close();
  }
}
