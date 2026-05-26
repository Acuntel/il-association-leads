# How to get the real data (one request)

Every automated, hands-off route was tested and ruled out:

- **Live scrape** → site is behind an Akamai WAF (blocks headless) **and** reCAPTCHA
  Enterprise on search submit. Getting past it programmatically = defeating a CAPTCHA;
  not doing that.
- **OpenCorporates API** → now requires a paid token; officer (president/secretary)
  detail is a paid tier.

The route that actually delivers the complete dataset (president, secretary, registered
agent + addresses, whole state) is the **official IL SOS bulk data file**. Request it:

## Option A — Free, if you qualify (fastest if eligible)

Illinois grants **free bulk data under an open public license** to nonprofits,
academics, journalists/media, and NGOs. If any entity you operate qualifies, apply for
that. (Source: OpenCorporates' IL onboarding; IL legislated open-data access.)

## Option B — Paid data contract (anyone)

Call **IL Dept. of Business Services: 217-782-6961** and ask for the **corporate/NFP
bulk data file**. Say verbatim:

> "I'd like to purchase the bulk corporation and not-for-profit data file — the Master,
> Agent, and Annual Report datasets. What's the cost, format, and how do I receive it?"

The data ships as fixed-width 119-char records (spec: ilsos.gov/data/bs/proc_corp_data.pdf).

## When the file arrives

1. Drop the files in `data/` (e.g. `master.txt`, `agent.txt`, `annual_report.txt`).
2. Open `layouts/il.json` and set each field's `[startColumn, length]` to match the
   official spec PDF (the values there now are placeholders).
3. Run:
   ```bash
   npm run leads -- extract --input data --out output/leads.csv --json
   npm run pdf -- --in output/leads.json --out output/leads.pdf \
         --title "Illinois Community Association Mailing List" \
         --source "Source: Illinois SOS bulk data, $(date +%Y-%m-%d)"
   ```
   That produces the real, current PDF — no `--sample` flag, no banner.

## Partial data today (no waiting)

If you want _some_ real records now and will click the occasional CAPTCHA:

```bash
npm run scrape:setup
npm run scrape -- --out output/leads.csv --max 25   # headed Chrome; solve CAPTCHA in the window
npm run pdf -- --in output/leads.jsonl --out output/leads.pdf \
      --source "Source: Illinois SOS live search, $(date +%Y-%m-%d)"
```

(Results/detail selectors in `src/scrape/selectors.ts` may need a one-line fix on first run.)
