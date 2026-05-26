# MASTER PROMPT — Illinois Association Lead Extractor (v2, post-analysis)

## Mission

Turn the Illinois Secretary of State's official bulk corporate/NFP data file into a
clean, deduplicated lead list of **community associations** (condominium, townhome,
and homeowner associations) with the **board president**, **secretary**, and
**registered agent** name + mailing address for each — ready for a direct-mail
mailer or, where an email can be resolved, an email campaign.

## Why this exists

Every prospect we want is a Not-For-Profit corporation whose legal name contains
"condominium association", "townhome association", or "homeowner association".
Each NFP files an annual report (Form NFP 114.05) listing officers, directors, and
a registered agent — all public record. Annual report due dates are the
incorporation-anniversary month and differ per entity, so the prospect universe is
a moving target that must be re-pulled periodically.

## Hard constraints

1. **No scraping.** We do not crawl or bulk-query the live Business Entity Search
   site — that violates IL SOS terms of service. We ingest the **officially
   purchased bulk data file** only.
2. **Legal output use.** Postal mailers are unrestricted (public record). Email must
   be CAN-SPAM compliant (truthful headers, physical address, working opt-out). The
   tool produces data; it does not send email.
3. **Portable.** The IL data model is consistent across states; the extractor must be
   schema-driven so another state's layout is a config change, not a code change.

## Input

Fixed-width text file(s) from IL SOS Dept. of Business Services. Records are
119 chars, joined by a file/company number. Datasets: Master, Name, Agent,
Annual Report, Assumed Name, Stock, Other.

The layout config (`layouts/il.json`) holds, per dataset: the 1-based field
offsets/lengths AND how that dataset is sourced — either a dedicated filename
(separate file per dataset) or a `recordType` field+value used to discriminate rows
in a combined file. This supports both distribution styles and makes another state a
config change, not a code change. Offsets ship as documented best-effort, marked to
verify against the official spec PDF (version 001, 2022-09-29); correcting them never
requires code edits.

## Processing pipeline

1. **Parse** each dataset's fixed-width records into typed rows via the layout
   config. **Stream line-by-line** — the file is millions of records; never load it
   all into memory.
2. **Filter to NFP first** using the Master record's entity-type code (config-driven
   NFP code set). A name match alone is insufficient: for-profit management companies
   also contain "association".
3. **Join** surviving file numbers across Master + Name + Agent + Annual Report. When
   a file number has multiple Annual Report records, keep the **most recent**.
4. **Match + classify** by legal name (case-insensitive, apostrophe-stripped,
   abbreviation-expanded: assn/assoc/assoc. → association, condo → condominium).
   Patterns: condominium / townhome / townhouse / homeowner(s) / home owners /
   owners / community association, and standalone "HOA". Classify into
   condo | townhome | homeowner | other.
5. **Extract** per entity: legal name, status, entity (principal) address split into
   components + a composed one-line mailing address, president (name + address),
   secretary (name + address), registered agent (name + address), incorporation date,
   anniversary month. Anniversary month = stored field if present, else derived from
   the incorporation date's month.
6. **Normalize**: collapse whitespace, trim, title-case names/addresses, uppercase
   state, zero-pad zip. Dedupe by file number. Exclude dissolved/withdrawn statuses
   unless `--include-inactive`.
7. **Mailer addressing (default):** address the piece to "Board of Directors,
   <Association>" at the **entity/registered-agent** address — not an officer's home
   (better deliverability, and we don't mail individuals' homes). Officer names are
   columns for personalization, not the mailing target. `--mail-to officer` overrides
   to the president's address.
8. **Output** CSV (mailer-ready) and optional JSON. `--refresh-due` lists entities
   whose anniversary month is the current or next month (the "moving target").

## Output columns (CSV)

file_number, entity_name, association_type, status, mail_to_name, mail_to_address,
entity_street, entity_city, entity_state, entity_zip, president_name,
president_address, secretary_name, secretary_address, agent_name, agent_address,
incorporation_date, anniversary_month

## CLI

```
leads extract --input data/ --layout layouts/il.json --out output/leads.csv \
      [--include-inactive] [--json] [--mail-to entity|officer]
leads refresh-due --input data/ --layout layouts/il.json   # entities due this/next month
leads stats --input data/ --layout layouts/il.json         # counts by type/status
```

## Quality bar

- Every file under 300 lines; functional, early-return style; TypeScript strict.
- Pure functions for parse/filter/extract so they are unit-testable without I/O.
- Ships with a synthetic sample-data generator so the full pipeline runs and tests
  pass without the (paid) real file.
- Tests cover: fixed-width parsing, the join, the association name matcher
  (positive + false-positive cases), dedupe, and the refresh-due window.

## Non-goals

- Sending email / running mail merges.
- Email-address discovery (documented as a downstream enrichment step, not built).
- Any live-site access.
