import type { AssociationType } from "./types.js";

// Normalize a legal name for matching: lowercase, strip apostrophes/punctuation,
// collapse whitespace, expand the abbreviations that appear in real SOS names.
export function normalizeName(name: string): string {
  let s = name.toLowerCase();
  s = s.replace(/['`.,]/g, " "); // apostrophes + dots/commas -> space
  s = s.replace(/[^a-z0-9 ]/g, " "); // any other punctuation -> space
  s = ` ${s.replace(/\s+/g, " ").trim()} `; // pad so word-boundary checks are simple
  s = s.replace(/ assn /g, " association ");
  s = s.replace(/ assoc /g, " association ");
  s = s.replace(/ condo /g, " condominium ");
  s = s.replace(/ twnhm /g, " townhome ");
  return s.replace(/\s+/g, " ");
}

// Does this entity name look like a community association? (run on normalized name)
export function isAssociation(rawName: string): boolean {
  return classifyAssociation(rawName) !== null;
}

// Classify, or return null if it is not a community association at all.
export function classifyAssociation(rawName: string): AssociationType | null {
  const n = normalizeName(rawName);
  if (n.includes(" hoa ")) return "homeowner";

  const hasAssociation = n.includes(" association ");
  if (!hasAssociation) return null;

  if (n.includes(" condominium ")) return "condo";
  if (n.includes(" townhome ") || n.includes(" townhouse ")) return "townhome";
  if (
    n.includes(" homeowner ") ||
    n.includes(" homeowners ") ||
    n.includes(" home owners ")
  ) {
    return "homeowner";
  }
  // "owners association" / "community association" are the catch-all association forms.
  if (
    n.includes(" owners association ") ||
    n.includes(" community association ")
  )
    return "other";
  return null;
}

// ---- address / value normalization ----

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bHoa\b/g, "HOA"); // keep the acronym uppercase
}

export function normalizeZip(zip: string): string {
  const digits = zip.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 5) return digits.padStart(5, "0");
  return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
}

// Compose a one-line mailing address from components.
export function composeAddress(
  street: string,
  city: string,
  state: string,
  zip: string,
): string {
  const line1 = titleCase(street);
  const cityPart = titleCase(city);
  const statePart = state.trim().toUpperCase();
  const zipPart = normalizeZip(zip);
  const cityStateZip = [
    cityPart,
    [statePart, zipPart].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [line1, cityStateZip].filter(Boolean).join(", ");
}

// Derive the 2-digit anniversary month: stored value if valid, else from YYYYMMDD.
export function anniversaryMonth(
  stored: string,
  incorporationDate: string,
): string {
  const m = parseInt(stored, 10);
  if (m >= 1 && m <= 12) return String(m).padStart(2, "0");
  if (/^\d{8}$/.test(incorporationDate)) {
    return incorporationDate.slice(4, 6);
  }
  return "";
}
