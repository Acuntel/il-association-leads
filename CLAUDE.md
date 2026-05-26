# CLAUDE.md — il-association-leads

## What this is

A TypeScript CLI that turns the **official IL SOS bulk corporate/NFP data file** into
a mailer-ready lead list of Illinois condominium/townhome/homeowner associations with
board president, secretary, and registered agent name + address.

## Non-negotiables

- **No scraping, ever.** Bulk-querying the live IL SOS Business Entity Search violates
  their ToS. We only ingest the officially purchased bulk data file. Do not add any
  live-site HTTP fetching.
- **Schema-driven.** All field byte-offsets live in `layouts/il.json`. Correcting the
  layout to match the official spec PDF must never require a code change. New states =
  new layout file.
- **Stream, never load-all.** The real file is millions of records.

## Layout

The offsets in `layouts/il.json` are a **best-effort placeholder**. The real spec is
the procedures PDF (`ilsos.gov/data/bs/proc_corp_data.pdf`, fixed 119-char records,
order via 217-782-6961). When the real file arrives, transcribe the official offsets
into the layout — confirm field positions before trusting output on real data.

## Files

```
src/types.ts     shared types
src/layout.ts    load/validate layout, fixed-width parseLine
src/stream.ts    streaming line reader (separate-file or combined-file)
src/match.ts     name normalization, association classifier, address helpers  (pure)
src/extract.ts   NFP/active filters, targetType, buildLead, most-recent join  (pure)
src/pipeline.ts  3-pass streaming orchestration, refresh-due, stats
src/cli.ts       argv parsing + subcommands (extract / refresh-due / stats)
scripts/make-sample.ts  synthetic fixed-width data built FROM the layout (test fixture)
test/*.test.ts   node:test, 22 tests
```

## Commands

- `npm run sample` — generate synthetic data into `data/`
- `npm run leads -- <cmd> ...` — run the CLI via tsx
- `npm test` / `npm run typecheck` — must stay green before committing

## Defaults / conventions

- TypeScript strict, ESM, functional + early returns, files < 300 lines.
- Mailer default targets "Board of Directors, <Association>" at the entity address —
  not officer home addresses (deliverability + privacy). `--mail-to officer` overrides.
- Licensed SOS data and generated output are gitignored; never commit `data/*.txt`.
