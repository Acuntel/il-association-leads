// Pure parser for the IL SOS business-entity-search results table.
// The results page renders a DataTable; each data row is six cells:
//   File Number | Entity Type | Entity Name | Entity Status | Effective Date | Registered Agent
// Verified against the live DOM (2026-05) via a partial-word search.

export interface ResultRow {
  fileNumber: string;
  entityType: string; // raw, e.g. "NFP (MST)", "LLC (MST)", "CORP (OLD)"
  entityName: string;
  status: string;
  effectiveDate: string; // MM-DD-YYYY
  registeredAgent: string;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract data rows (skips the header <tr>, which uses <th>).
export function parseResultsTable(html: string): ResultRow[] {
  const rows: ResultRow[] = [];
  const trMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    if (/<th\b/i.test(tr)) continue; // header row
    const tds = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      stripTags(m[1] ?? ""),
    );
    if (tds.length < 6) continue;
    const [
      fileNumber,
      entityType,
      entityName,
      status,
      effectiveDate,
      registeredAgent,
    ] = tds;
    if (!fileNumber || !entityName) continue;
    rows.push({
      fileNumber: fileNumber!,
      entityType: entityType ?? "",
      entityName: entityName!,
      status: status ?? "",
      effectiveDate: effectiveDate ?? "",
      registeredAgent: registeredAgent ?? "",
    });
  }
  return rows;
}

// Normalize the table's entity-type ("NFP (MST)" / "NFP (OLD)") to a layout code ("NFP").
export function normalizeEntityType(raw: string): string {
  const m = raw.match(/^([A-Za-z]+)/);
  return (m?.[1] ?? raw).toUpperCase();
}

// MM-DD-YYYY -> YYYYMMDD (pipeline's expected incorporation-date format).
export function normalizeDate(raw: string): string {
  const m = raw.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!m) return "";
  return `${m[3]}${m[1]!.padStart(2, "0")}${m[2]!.padStart(2, "0")}`;
}
