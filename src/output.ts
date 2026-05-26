import type { Lead } from "./types.js";

const COLUMNS: (keyof Lead)[] = [
  "fileNumber",
  "entityName",
  "associationType",
  "status",
  "mailToName",
  "mailToAddress",
  "entityStreet",
  "entityCity",
  "entityState",
  "entityZip",
  "presidentName",
  "presidentAddress",
  "secretaryName",
  "secretaryAddress",
  "agentName",
  "agentAddress",
  "incorporationDate",
  "anniversaryMonth",
];

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = COLUMNS.join(",");
  const rows = leads.map((lead) =>
    COLUMNS.map((col) => csvCell(lead[col] ?? "")).join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

export function leadsToJson(leads: Lead[]): string {
  return JSON.stringify(leads, null, 2) + "\n";
}
