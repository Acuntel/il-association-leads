// ============================================================================
// SITE-SPECIFIC CONFIG — the ONLY place that knows the IL SOS search DOM.
//
// These selectors are a documented best-effort. They were NOT verified against
// the live DOM because apps.ilsos.gov sits behind an Akamai-class WAF that blocks
// automated access from a datacenter IP (the build sandbox). When you first run
// the scraper on your machine, open the search page in DevTools and confirm each
// selector below; fixing a wrong one is a single edit here, no logic changes.
//
// To capture a selector: right-click the element -> Inspect -> Copy -> Copy selector,
// then paste it here. Prefer stable ids/names over deep CSS paths.
// ============================================================================

export interface SiteConfig {
  searchUrl: string;
  // The search form: where to type the keyword and how to submit.
  searchInput: string; // text input for the entity-name keyword search
  searchTypeNameRadio?: string; // radio/option to choose "search by name" (if present)
  searchSubmit: string; // the Search button
  // Results listing:
  resultRow: string; // each result row/link in the results table
  resultLink: string; // the clickable entity link within a row (relative to resultRow)
  nextPage?: string; // the "next page" control (omit if single page / infinite)
  // Detail page fields (text content is read and trimmed):
  detail: {
    entityName: string;
    fileNumber: string;
    entityType: string; // e.g. text containing "NOT FOR PROFIT CORPORATION"
    status: string;
    incorporationDate: string;
    agentName: string;
    agentAddress: string;
    // Officer/president/secretary often live behind a tab — give the tab selector
    // and the field selectors that become visible after clicking it.
    officerTab?: string;
    presidentName: string;
    presidentAddress: string;
    secretaryName: string;
    secretaryAddress: string;
  };
}

// Best-effort defaults for the modern apps.ilsos.gov/businessentitysearch app.
// VERIFY THESE LIVE before trusting output.
export const IL: SiteConfig = {
  searchUrl: "https://apps.ilsos.gov/businessentitysearch/",
  searchInput:
    "input[name*='SearchText'], input#SearchText, input[type='text']",
  searchTypeNameRadio:
    "input[value='Name'], input[name*='SearchType'][value*='ame']",
  searchSubmit: "button[type='submit'], input[type='submit'], #btnSearch",
  resultRow: "table tbody tr",
  resultLink: "a",
  nextPage: "a[rel='next'], a.next, a[aria-label='Next']",
  detail: {
    entityName: "#entityName, [data-field='name'], h1",
    fileNumber: "#fileNumber, [data-field='fileNumber']",
    entityType: "#entityType, [data-field='type']",
    status: "#status, [data-field='status']",
    incorporationDate: "#incorporationDate, [data-field='incDate']",
    agentName: "#agentName, [data-field='agentName']",
    agentAddress: "#agentAddress, [data-field='agentAddress']",
    officerTab: "a[href*='officer' i], button:has-text('Officer')",
    presidentName: "[data-officer='president'] .name, #presidentName",
    presidentAddress: "[data-officer='president'] .address, #presidentAddress",
    secretaryName: "[data-officer='secretary'] .name, #secretaryName",
    secretaryAddress: "[data-officer='secretary'] .address, #secretaryAddress",
  },
};

// The keyword searches that enumerate the prospect universe.
export const ASSOCIATION_KEYWORDS = [
  "condominium association",
  "townhome association",
  "townhouse association",
  "homeowners association",
  "homeowner association",
  "community association",
  "owners association",
];
