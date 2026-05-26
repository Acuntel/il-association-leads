import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLead,
  isActive,
  isNfp,
  moreRecent,
  targetType,
} from "../src/extract.js";
import type { Layout, Row } from "../src/types.js";

const layout = {
  nfpEntityTypes: ["NFP"],
  activeStatuses: ["AC", "GS"],
  inactiveStatuses: ["DS", "WD"],
} as unknown as Layout;

const master: Row = {
  fileNumber: "00100001",
  entityName: "WILLOW CREEK CONDOMINIUM ASSOCIATION",
  entityType: "NFP",
  status: "AC",
  incorporationDate: "19980312",
  anniversaryMonth: "03",
  entityStreet: "120 WILLOW CREEK DR",
  entityCity: "NAPERVILLE",
  entityState: "IL",
  entityZip: "60540",
};

test("isNfp / isActive honor the layout code sets", () => {
  assert.equal(isNfp(master, layout), true);
  assert.equal(isNfp({ ...master, entityType: "LLC" }, layout), false);
  assert.equal(isActive("AC", layout), true);
  assert.equal(isActive("DS", layout), false);
});

test("targetType requires NFP AND an association name", () => {
  assert.equal(targetType(master, layout), "condo");
  assert.equal(targetType({ ...master, entityType: "LLC" }, layout), null); // for-profit
  assert.equal(
    targetType({ ...master, entityName: "ILLINOIS BAR ASSOCIATION" }, layout),
    null,
  );
});

test("buildLead defaults mail target to the board at the entity address", () => {
  const annual: Row = {
    presidentName: "ROBERT HALE",
    presidentStreet: "5 HOME LN",
    presidentCity: "NAPERVILLE",
    presidentState: "IL",
    presidentZip: "60540",
    secretaryName: "SUSAN PARK",
  };
  const agent: Row = {
    agentName: "JANE MILLER",
    agentStreet: "1 AGENT RD",
    agentCity: "CHICAGO",
    agentState: "IL",
    agentZip: "60601",
  };
  const lead = buildLead(master, agent, annual, "condo", "entity");
  assert.equal(
    lead.mailToName,
    "Board of Directors, Willow Creek Condominium Association",
  );
  assert.equal(lead.mailToAddress, "120 Willow Creek Dr, Naperville, IL 60540");
  assert.equal(lead.presidentName, "Robert Hale");
  assert.equal(lead.agentName, "Jane Miller");
});

test("buildLead with --mail-to officer targets the president", () => {
  const annual: Row = {
    presidentName: "ROBERT HALE",
    presidentStreet: "5 HOME LN",
    presidentCity: "NAPERVILLE",
    presidentState: "IL",
    presidentZip: "60540",
  };
  const lead = buildLead(master, undefined, annual, "condo", "officer");
  assert.equal(lead.mailToName, "Robert Hale");
  assert.equal(lead.mailToAddress, "5 Home Ln, Naperville, IL 60540");
});

test("buildLead falls back to agent address when entity address is blank", () => {
  const bare = {
    ...master,
    entityStreet: "",
    entityCity: "",
    entityState: "",
    entityZip: "",
  };
  const agent: Row = {
    agentName: "JANE MILLER",
    agentStreet: "1 AGENT RD",
    agentCity: "CHICAGO",
    agentState: "IL",
    agentZip: "60601",
  };
  const lead = buildLead(bare, agent, undefined, "condo", "entity");
  assert.equal(lead.mailToAddress, "1 Agent Rd, Chicago, IL 60601");
});

test("moreRecent keeps the higher recency value", () => {
  const a: Row = { reportYear: "2019" };
  const b: Row = { reportYear: "2025" };
  assert.equal(moreRecent(a, b, "reportYear").reportYear, "2025");
  assert.equal(moreRecent(b, a, "reportYear").reportYear, "2025");
  assert.equal(moreRecent(undefined, a, "reportYear").reportYear, "2019");
});
