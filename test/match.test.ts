import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anniversaryMonth,
  classifyAssociation,
  composeAddress,
  normalizeName,
  normalizeZip,
  titleCase,
} from "../src/match.js";

test("titleCase keeps HOA uppercase", () => {
  assert.equal(titleCase("LAKESIDE HOA"), "Lakeside HOA");
  assert.equal(
    titleCase("WILLOW CREEK CONDOMINIUM ASSOCIATION"),
    "Willow Creek Condominium Association",
  );
});

test("normalizeName expands abbreviations and strips apostrophes", () => {
  assert.equal(
    normalizeName("Oakwood Homeowners' Assn."),
    " oakwood homeowners association ",
  );
  assert.equal(
    normalizeName("Sunset Condo Assoc"),
    " sunset condominium association ",
  );
});

test("classifyAssociation: condo / townhome / homeowner / hoa", () => {
  assert.equal(
    classifyAssociation("WILLOW CREEK CONDOMINIUM ASSOCIATION"),
    "condo",
  );
  assert.equal(
    classifyAssociation("MAPLE RIDGE TOWNHOME ASSOCIATION"),
    "townhome",
  );
  assert.equal(classifyAssociation("Brook Townhouse Association"), "townhome");
  assert.equal(
    classifyAssociation("OAKWOOD HOMEOWNERS' ASSOCIATION"),
    "homeowner",
  );
  assert.equal(classifyAssociation("LAKESIDE HOA"), "homeowner");
  assert.equal(
    classifyAssociation("Riverwoods Community Association"),
    "other",
  );
  assert.equal(classifyAssociation("Harbor Owners Association"), "other");
});

test("classifyAssociation rejects non-community associations", () => {
  assert.equal(classifyAssociation("ILLINOIS STATE BAR ASSOCIATION"), null);
  assert.equal(classifyAssociation("National Restaurant Association"), null);
  assert.equal(classifyAssociation("Acme Plumbing Inc"), null);
  // "hoa" must be a whole word, not a substring like "Tahoacorp"
  assert.equal(classifyAssociation("Tahoacorp LLC"), null);
});

test("composeAddress builds a clean one-line address", () => {
  assert.equal(
    composeAddress("120 WILLOW CREEK DR", "NAPERVILLE", "il", "60540"),
    "120 Willow Creek Dr, Naperville, IL 60540",
  );
  assert.equal(composeAddress("", "", "", ""), "");
});

test("normalizeZip pads and hyphenates", () => {
  assert.equal(normalizeZip("60540"), "60540");
  assert.equal(normalizeZip("605401234"), "60540-1234");
  assert.equal(normalizeZip("1234"), "01234");
  assert.equal(normalizeZip(""), "");
});

test("anniversaryMonth uses stored value or derives from incorporation date", () => {
  assert.equal(anniversaryMonth("07", "20050701"), "07");
  assert.equal(anniversaryMonth("", "19980312"), "03");
  assert.equal(anniversaryMonth("99", "19980312"), "03");
  assert.equal(anniversaryMonth("", ""), "");
});
