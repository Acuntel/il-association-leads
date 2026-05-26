// Pure parser for an IL SOS entity DETAIL page (read from the page's innerText).
// The detail page is a label/value layout, e.g.:
//   Entity Name \n <name> \n Principal Address \n <street> \n <city,ST zip> \n
//   File Number \n <#> \n ... \n Agent Information \n <name> \n <street> \n <city, ST zip>
// Verified against the live page (2026-05).

export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface EntityDetail {
  fileNumber: string;
  principal: AddressParts;
  agentName: string;
  agent: AddressParts;
  presidentName: string;
  president: AddressParts;
  secretaryName: string;
  secretary: AddressParts;
}

// Field labels on the detail page — used as boundaries when slicing values.
const LABELS = new Set([
  "Entity Name",
  "Principal Address",
  "File Number",
  "Status",
  "Entity Type",
  "Type of LLC",
  "Type of Corp",
  "Org. Date/Admission Date",
  "Org. Date",
  "Admission Date",
  "Jurisdiction",
  "Duration",
  "Annual Report",
  "Filing Date",
  "Year",
  "Agent Information",
  "Agent Name",
  "Agent Change Date",
  "President Name & Address",
  "President",
  "Secretary Name & Address",
  "Secretary",
  "Officers",
  "Managers",
  "Services and More Information",
  "Available Services",
]);

const EMPTY: AddressParts = { street: "", city: "", state: "", zip: "" };

// Lines that follow `label`, up to the next known label.
function valuesAfter(lines: string[], label: string): string[] {
  const i = lines.indexOf(label);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (LABELS.has(lines[j]!)) break;
    out.push(lines[j]!);
  }
  return out;
}

// Parse an address block (street line(s) + a final "City, ST ZIP" line).
export function parseAddrBlock(lines: string[]): AddressParts {
  if (lines.length === 0) return { ...EMPTY };
  const last = lines[lines.length - 1]!;
  const m = last.match(/^(.+?),?\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (m) {
    return {
      street: lines.slice(0, -1).join(", "),
      city: m[1]!.trim(),
      state: m[2]!,
      zip: m[3]!,
    };
  }
  return { street: lines.join(", "), city: "", state: "", zip: "" };
}

// First value line is a name; the rest is the address block.
function nameAndAddress(lines: string[]): { name: string; addr: AddressParts } {
  if (lines.length === 0) return { name: "", addr: { ...EMPTY } };
  return { name: lines[0]!, addr: parseAddrBlock(lines.slice(1)) };
}

export function parseDetailText(text: string): EntityDetail {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const fileNumber = (valuesAfter(lines, "File Number")[0] ?? "").trim();
  const principal = parseAddrBlock(valuesAfter(lines, "Principal Address"));
  const agent = nameAndAddress(valuesAfter(lines, "Agent Information"));
  const pres = nameAndAddress(
    valuesAfter(lines, "President Name & Address").length
      ? valuesAfter(lines, "President Name & Address")
      : valuesAfter(lines, "President"),
  );
  const sec = nameAndAddress(
    valuesAfter(lines, "Secretary Name & Address").length
      ? valuesAfter(lines, "Secretary Name & Address")
      : valuesAfter(lines, "Secretary"),
  );
  return {
    fileNumber,
    principal,
    agentName: agent.name,
    agent: agent.addr,
    presidentName: pres.name,
    president: pres.addr,
    secretaryName: sec.name,
    secretary: sec.addr,
  };
}
