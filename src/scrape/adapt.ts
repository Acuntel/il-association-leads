import { buildLead, targetType } from "../extract.js";
import type { Layout, Lead, MailTo, Row } from "../types.js";

// A record as scraped from a detail page (addresses are raw one-line strings).
export interface ScrapedEntity {
  fileNumber: string;
  entityName: string;
  entityType: string; // raw site text, e.g. "NOT FOR PROFIT CORPORATION"
  status: string;
  incorporationDate: string; // raw site text, normalized below
  agentName: string;
  agentAddress: string;
  presidentName: string;
  presidentAddress: string;
  secretaryName: string;
  secretaryAddress: string;
}

// Split a one-line "123 Main St, Chicago, IL 60601" into components so the
// existing composeAddress() can re-normalize it. Tolerant of missing pieces.
export function parseAddress(raw: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const m = last.match(/([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (m && parts.length >= 2) {
    return {
      street: parts.slice(0, -2).join(", "),
      city: parts[parts.length - 2] ?? "",
      state: m[1] ?? "",
      zip: m[2] ?? "",
    };
  }
  return { street: parts.join(", "), city: "", state: "", zip: "" };
}

// IL detail pages render "MM/DD/YYYY"; the pipeline wants YYYYMMDD.
function normDate(raw: string): string {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return raw.replace(/\D/g, "").slice(0, 8);
  return `${m[3]}${m[1]!.padStart(2, "0")}${m[2]!.padStart(2, "0")}`;
}

function normType(raw: string): string {
  return /not.?for.?profit/i.test(raw) ? "NFP" : raw.trim().toUpperCase();
}

// Convert a scraped entity into a Lead, or null if it is not a target NFP
// community association. Reuses the file-pipeline's classify + build logic.
export function scrapedToLead(
  e: ScrapedEntity,
  layout: Layout,
  mailTo: MailTo,
): Lead | null {
  const agentAddr = parseAddress(e.agentAddress);
  const presAddr = parseAddress(e.presidentAddress);
  const secAddr = parseAddress(e.secretaryAddress);

  const master: Row = {
    fileNumber: e.fileNumber,
    entityName: e.entityName,
    entityType: normType(e.entityType),
    status: e.status,
    incorporationDate: normDate(e.incorporationDate),
    anniversaryMonth: "",
    // Use the registered-agent address as the entity mailing address.
    entityStreet: agentAddr.street,
    entityCity: agentAddr.city,
    entityState: agentAddr.state,
    entityZip: agentAddr.zip,
  };

  const type = targetType(master, layout);
  if (!type) return null;

  const agent: Row = {
    agentName: e.agentName,
    agentStreet: agentAddr.street,
    agentCity: agentAddr.city,
    agentState: agentAddr.state,
    agentZip: agentAddr.zip,
  };
  const annual: Row = {
    presidentName: e.presidentName,
    presidentStreet: presAddr.street,
    presidentCity: presAddr.city,
    presidentState: presAddr.state,
    presidentZip: presAddr.zip,
    secretaryName: e.secretaryName,
    secretaryStreet: secAddr.street,
    secretaryCity: secAddr.city,
    secretaryState: secAddr.state,
    secretaryZip: secAddr.zip,
  };

  return buildLead(master, agent, annual, type, mailTo);
}
