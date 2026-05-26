# il-association-leads

Extract a clean, mailer-ready lead list of **Illinois community associations**
(condominium / townhome / homeowner associations + HOAs) — with the board
**president**, **secretary**, and **registered agent** name and address for each —
from the **official Illinois Secretary of State bulk corporate/NFP data file**.

> **No scraping.** This tool does _not_ crawl the live IL SOS Business Entity Search.
> That violates their terms of service. It reads the bulk data file the SOS sells —
> which is the legal, durable way to get this data. See [Legal](#legal).

## Why this works

Every prospect is a Not-For-Profit corporation whose legal name contains
"condominium association", "townhome association", or "homeowner association". Each
NFP files an annual report (Form NFP 114.05) that lists its officers, directors, and
registered agent — **all public record**. Annual report due dates fall in each
entity's incorporation-anniversary month and differ per entity, so the prospect list
is a moving target: re-pull the file periodically and use `refresh-due` to time
mailers to associations filing this/next month.

## Getting the data (one phone call)

1. Call the **IL SOS Department of Business Services: 217-782-6961** and order the
   corporate/NFP bulk data file. (Procedures PDF: `ilsos.gov/data/bs/proc_corp_data.pdf`.)
2. It arrives as fixed-width **119-char records** across up to 7 datasets (Master,
   Name, Agent, Annual Report, Assumed Name, Stock, Other). Drop the relevant files
   into `data/`.
3. **Transcribe the official field byte-offsets into `layouts/il.json`.** The offsets
   shipped there are a documented best-effort placeholder — open the procedures PDF
   and set the real `[startColumn, length]` for each field. **No code changes needed**;
   the parser is fully driven by that config.

Until you have the real file, generate synthetic sample data to see it work:

```bash
npm install
npm run sample                # writes data/{master,agent,annual_report}.txt
npm run leads -- extract --input data --out output/leads.csv --json
```

## Usage

```bash
# Build the lead list (CSV, + JSON with --json)
leads extract --input data --layout layouts/il.json --out output/leads.csv [--json] \
      [--include-inactive] [--mail-to entity|officer]

# Associations whose anniversary month is this or next month (time your mailers)
leads refresh-due --input data --layout layouts/il.json

# Counts by association type and status
leads stats --input data --layout layouts/il.json
```

`--mail-to entity` (default) addresses each piece to "Board of Directors,
<Association>" at the entity/registered-agent address — better deliverability, and
we don't mail individuals' homes. `--mail-to officer` targets the president instead.

### Output columns

`file_number, entity_name, association_type, status, mail_to_name, mail_to_address,
entity_street, entity_city, entity_state, entity_zip, president_name,
president_address, secretary_name, secretary_address, agent_name, agent_address,
incorporation_date, anniversary_month`

## How it works

1. **Stream** each dataset line-by-line (the real file is millions of records).
2. **NFP filter first** on the Master record's entity-type code — a name match alone
   would catch for-profit management LLCs.
3. **Classify** by name with apostrophe-stripping + abbreviation expansion
   (`assn`/`assoc` → association, `condo` → condominium).
4. **Join** Master + Agent + most-recent Annual Report by file number.
5. **Normalize** addresses, dedupe, and emit CSV/JSON.

Pure functions live in `src/match.ts` and `src/extract.ts`; the streaming I/O is in
`src/stream.ts` / `src/pipeline.ts`. Run `npm test` (22 tests) and `npm run typecheck`.

## Portability to other states

The data model (entity + officers + registered agent, public record) is consistent
across states. To add one, copy `layouts/il.json` to `layouts/<state>.json`, set its
field offsets/format, and point `--layout` at it. No code changes.

## Legal

- **Postal mailers**: public-record corporate filings; unrestricted.
- **Email**: if you resolve addresses, every send must be **CAN-SPAM** compliant —
  truthful headers, a physical mailing address, and a working opt-out. This tool
  produces data only; it does not send email and does not discover email addresses.
- **Acquisition**: official bulk data, not scraping. Bulk-querying the live search
  site violates IL SOS terms of service.
