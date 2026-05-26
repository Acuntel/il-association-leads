import type { Lead } from "./types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface PdfMeta {
  title: string;
  sourceNote: string; // provenance line, e.g. "Source: IL SOS bulk file, 2026-05-26"
  sample: boolean; // stamp a SAMPLE watermark/banner when not real data
}

// Render leads into a print-ready HTML directory (Chromium prints it to PDF).
export function leadsToHtml(leads: Lead[], meta: PdfMeta): string {
  const generated = new Date().toISOString().slice(0, 10);
  const banner = meta.sample
    ? `<div class="sample">SAMPLE DATA — not real Secretary of State records</div>`
    : "";
  const rows = leads
    .map(
      (l, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td><strong>${esc(l.entityName)}</strong><br><span class="t">${esc(l.associationType)} · ${esc(l.status)} · anniv ${esc(l.anniversaryMonth || "?")}</span></td>
      <td>${esc(l.mailToName)}<br><span class="a">${esc(l.mailToAddress)}</span></td>
      <td>${esc(l.presidentName || "—")}<br><span class="a">${esc(l.presidentAddress)}</span></td>
      <td>${esc(l.secretaryName || "—")}</td>
      <td>${esc(l.agentName || "—")}<br><span class="a">${esc(l.agentAddress)}</span></td>
    </tr>`,
    )
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: letter landscape; margin: 14mm 12mm; }
  body { font: 11px -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .meta { color: #555; font-size: 11px; margin-bottom: 12px; }
  .sample { background: #b00020; color: #fff; padding: 6px 10px; border-radius: 4px;
            font-weight: 700; letter-spacing: .04em; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #f1f1f1; padding: 6px 8px; border-bottom: 2px solid #999;
       font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 7px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .n { color: #999; }
  .t { color: #777; font-size: 10px; }
  .a { color: #555; font-size: 10px; }
  </style></head><body>
  ${banner}
  <h1>${esc(meta.title)}</h1>
  <div class="meta">${esc(meta.sourceNote)} · ${leads.length} associations · generated ${generated}</div>
  <table>
    <thead><tr><th>#</th><th>Association</th><th>Mail to</th><th>President</th><th>Secretary</th><th>Registered agent</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </body></html>`;
}
