import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAddress,
  scrapedToLead,
  type ScrapedEntity,
} from "../src/scrape/adapt.js";
import type { Layout } from "../src/types.js";

const layout = {
  nfpEntityTypes: ["NFP"],
  activeStatuses: ["AC", "GS"],
  inactiveStatuses: ["DS", "WD"],
} as unknown as Layout;

test("parseAddress splits a one-line address into components", () => {
  assert.deepEqual(parseAddress("120 Willow Creek Dr, Naperville, IL 60540"), {
    street: "120 Willow Creek Dr",
    city: "Naperville",
    state: "IL",
    zip: "60540",
  });
});

test("parseAddress degrades gracefully on messy input", () => {
  const r = parseAddress("PO BOX 7");
  assert.equal(r.street, "PO BOX 7");
  assert.equal(r.state, "");
});

const base: ScrapedEntity = {
  fileNumber: "00100001",
  entityName: "WILLOW CREEK CONDOMINIUM ASSOCIATION",
  entityType: "NOT FOR PROFIT CORPORATION",
  status: "AC",
  incorporationDate: "03/12/1998",
  agentName: "JANE MILLER",
  agentAddress: "1 Agent Rd, Chicago, IL 60601",
  presidentName: "ROBERT HALE",
  presidentAddress: "5 Home Ln, Naperville, IL 60540",
  secretaryName: "SUSAN PARK",
  secretaryAddress: "5 Home Ln, Naperville, IL 60540",
};

test("scrapedToLead maps an NFP association and normalizes the date", () => {
  const lead = scrapedToLead(base, layout, "entity");
  assert.ok(lead);
  assert.equal(lead.associationType, "condo");
  assert.equal(lead.incorporationDate, "19980312");
  assert.equal(lead.anniversaryMonth, "03"); // derived from incorporation month
  assert.equal(
    lead.mailToName,
    "Board of Directors, Willow Creek Condominium Association",
  );
  assert.equal(lead.agentName, "Jane Miller");
  assert.equal(lead.presidentName, "Robert Hale");
});

test("scrapedToLead rejects a non-NFP entity that matched the keyword", () => {
  const llc = {
    ...base,
    entityType: "LIMITED LIABILITY COMPANY",
    entityName: "SUNSET CONDOMINIUM MANAGEMENT LLC",
  };
  assert.equal(scrapedToLead(llc, layout, "entity"), null);
});
