import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAddrBlock, parseDetailText } from "../src/scrape/parse-detail.js";

// Real detail-page innerText shape captured from the live site (2026-05).
const TEXT = `Business Entity Search
Entity Information
Entity Name
ABBEYWOOD CONDOMINIUM ASSOCIATION
Principal Address
123 ABBEY LN
NAPERVILLE,IL 60540
File Number
55512345
Status
GOOD STANDING
Entity Type
NFP
Org. Date/Admission Date
03-12-1998
Agent Information
JANE MILLER
1 AGENT RD
CHICAGO, IL 60601
Agent Change Date
03-12-1998
President Name & Address
ROBERT HALE
5 HOME LN
NAPERVILLE, IL 60540
Secretary Name & Address
SUSAN PARK
5 HOME LN
NAPERVILLE, IL 60540
Services and More Information`;

test("parseAddrBlock splits street lines from the final City,ST ZIP line", () => {
  assert.deepEqual(parseAddrBlock(["123 ABBEY LN", "NAPERVILLE,IL 60540"]), {
    street: "123 ABBEY LN",
    city: "NAPERVILLE",
    state: "IL",
    zip: "60540",
  });
  assert.deepEqual(
    parseAddrBlock(["1 AGENT RD", "STE 200", "CHICAGO, IL 60601-1234"]),
    {
      street: "1 AGENT RD, STE 200",
      city: "CHICAGO",
      state: "IL",
      zip: "60601-1234",
    },
  );
});

test("parseDetailText pulls principal address, agent, and officers", () => {
  const d = parseDetailText(TEXT);
  assert.equal(d.fileNumber, "55512345");
  assert.deepEqual(d.principal, {
    street: "123 ABBEY LN",
    city: "NAPERVILLE",
    state: "IL",
    zip: "60540",
  });
  assert.equal(d.agentName, "JANE MILLER");
  assert.equal(d.agent.city, "CHICAGO");
  assert.equal(d.presidentName, "ROBERT HALE");
  assert.equal(d.president.street, "5 HOME LN");
  assert.equal(d.secretaryName, "SUSAN PARK");
});
