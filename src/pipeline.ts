import { buildLead, isActive, moreRecent, targetType } from "./extract.js";
import { streamRows } from "./stream.js";
import type { AssociationType, Layout, Lead, MailTo, Row } from "./types.js";

export interface PipelineOptions {
  includeInactive: boolean;
  mailTo: MailTo;
}

// Run the full extract pipeline with three streaming passes:
//   1. master  -> collect target NFP associations (small set)
//   2. agent   -> attach registered agent for target file numbers
//   3. annual  -> attach most-recent annual report for target file numbers
export async function extractLeads(
  rootDir: string,
  layout: Layout,
  opts: PipelineOptions,
): Promise<Lead[]> {
  const targets = new Map<string, { master: Row; type: AssociationType }>();

  for await (const master of streamRows(rootDir, layout, "master")) {
    const type = targetType(master, layout);
    if (!type) continue;
    if (!opts.includeInactive && !isActive(master.status ?? "", layout))
      continue;
    const fileNumber = master.fileNumber ?? "";
    if (fileNumber) targets.set(fileNumber, { master, type });
  }

  const agents = new Map<string, Row>();
  for await (const agent of streamRows(rootDir, layout, "agent")) {
    const fn = agent.fileNumber ?? "";
    if (targets.has(fn)) agents.set(fn, agent);
  }

  const recencyField =
    layout.datasets.annualReport.recencyField ?? "reportYear";
  const annuals = new Map<string, Row>();
  for await (const annual of streamRows(rootDir, layout, "annualReport")) {
    const fn = annual.fileNumber ?? "";
    if (!targets.has(fn)) continue;
    annuals.set(fn, moreRecent(annuals.get(fn), annual, recencyField));
  }

  const leads: Lead[] = [];
  for (const [fn, { master, type }] of targets) {
    leads.push(
      buildLead(master, agents.get(fn), annuals.get(fn), type, opts.mailTo),
    );
  }
  leads.sort((a, b) => a.entityName.localeCompare(b.entityName));
  return leads;
}

// Months that count as "refresh due": current and next (1-12, wrapping Dec->Jan).
export function dueMonths(now: Date): Set<string> {
  const m = now.getMonth() + 1; // 1-12
  const next = (m % 12) + 1;
  return new Set([String(m).padStart(2, "0"), String(next).padStart(2, "0")]);
}

export function filterRefreshDue(leads: Lead[], now: Date): Lead[] {
  const due = dueMonths(now);
  return leads.filter((l) => due.has(l.anniversaryMonth));
}

export interface Stats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export function computeStats(leads: Lead[]): Stats {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const l of leads) {
    byType[l.associationType] = (byType[l.associationType] ?? 0) + 1;
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  }
  return { total: leads.length, byType, byStatus };
}
