// Generate synthetic fixed-width SOS sample files so the whole pipeline runs and
// tests pass WITHOUT the real (paid) IL SOS data file. Records are built from the
// same layout config the parser reads, so offsets can never drift between them.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLayout } from "../src/layout.js";
import type { DatasetLayout, Layout, Row } from "../src/types.js";

function buildLine(
  ds: DatasetLayout,
  recordLength: number,
  values: Row,
): string {
  let maxEnd = recordLength;
  for (const [, [start, length]] of Object.entries(ds.fields)) {
    maxEnd = Math.max(maxEnd, start - 1 + length);
  }
  const chars = new Array(maxEnd).fill(" ");
  for (const [field, [start, length]] of Object.entries(ds.fields)) {
    const v = (values[field] ?? "").slice(0, length);
    for (let i = 0; i < v.length; i++) chars[start - 1 + i] = v[i];
  }
  return chars.join("").replace(/\s+$/, "");
}

interface Entity {
  fileNumber: string;
  name: string;
  type: string;
  status: string;
  inc: string;
  anniv: string;
  street: string;
  city: string;
  zip: string;
  agent: string;
  president: string;
  secretary: string;
  reportYear: string;
}

const ENTITIES: Entity[] = [
  {
    fileNumber: "00100001",
    name: "WILLOW CREEK CONDOMINIUM ASSOCIATION",
    type: "NFP",
    status: "AC",
    inc: "19980312",
    anniv: "03",
    street: "120 WILLOW CREEK DR",
    city: "NAPERVILLE",
    zip: "60540",
    agent: "JANE MILLER",
    president: "ROBERT HALE",
    secretary: "SUSAN PARK",
    reportYear: "2025",
  },
  {
    fileNumber: "00100002",
    name: "MAPLE RIDGE TOWNHOME ASSOCIATION",
    type: "NFP",
    status: "AC",
    inc: "20050701",
    anniv: "07",
    street: "8 MAPLE RIDGE CT",
    city: "AURORA",
    zip: "60504",
    agent: "TOM REED",
    president: "ALICE NG",
    secretary: "DAVID KIM",
    reportYear: "2024",
  },
  {
    fileNumber: "00100003",
    name: "OAKWOOD HOMEOWNERS' ASSOCIATION",
    type: "NFP",
    status: "AC",
    inc: "20011120",
    anniv: "11",
    street: "55 OAKWOOD LN",
    city: "EVANSTON",
    zip: "60201",
    agent: "PAT LOWE",
    president: "MARIA SOTO",
    secretary: "JOHN WEBB",
    reportYear: "2025",
  },
  {
    fileNumber: "00100004",
    name: "LAKESIDE HOA",
    type: "NFP",
    status: "AC",
    inc: "20100509",
    anniv: "05",
    street: "3 LAKESIDE WAY",
    city: "SCHAUMBURG",
    zip: "60173",
    agent: "KAY FOX",
    president: "ERIC LIN",
    secretary: "NINA ROSS",
    reportYear: "2025",
  },
  {
    fileNumber: "00100005",
    name: "RIVERWOODS COMMUNITY ASSOCIATION",
    type: "NFP",
    status: "GS",
    inc: "19950815",
    anniv: "08",
    street: "400 RIVER RD",
    city: "DEERFIELD",
    zip: "60015",
    agent: "LEE GRANT",
    president: "OMAR DIAZ",
    secretary: "BETH COLE",
    reportYear: "2023",
  },
  // Non-targets below — must be excluded:
  {
    fileNumber: "00100006",
    name: "ILLINOIS STATE BAR ASSOCIATION",
    type: "NFP",
    status: "AC",
    inc: "18770101",
    anniv: "01",
    street: "20 S CLARK ST",
    city: "CHICAGO",
    zip: "60603",
    agent: "BAR ADMIN",
    president: "GAIL WU",
    secretary: "SAM ORR",
    reportYear: "2025",
  },
  {
    fileNumber: "00100007",
    name: "SUNSET CONDOMINIUM MANAGEMENT LLC",
    type: "LLC",
    status: "AC",
    inc: "20150101",
    anniv: "01",
    street: "1 SUNSET BLVD",
    city: "CHICAGO",
    zip: "60601",
    agent: "CORP AGENT",
    president: "",
    secretary: "",
    reportYear: "2025",
  },
  {
    fileNumber: "00100008",
    name: "PINEHURST CONDOMINIUM ASSOCIATION",
    type: "NFP",
    status: "DS",
    inc: "19900101",
    anniv: "01",
    street: "9 PINE ST",
    city: "PEORIA",
    zip: "61602",
    agent: "OLD AGENT",
    president: "DEAD ENTITY",
    secretary: "NONE",
    reportYear: "2012",
  },
];

function main(): void {
  const layoutPath = process.argv[2] ?? "layouts/il.json";
  const outDir = process.argv[3] ?? "data";
  const layout: Layout = loadLayout(layoutPath);
  mkdirSync(outDir, { recursive: true });

  const masterLines: string[] = [];
  const agentLines: string[] = [];
  const annualLines: string[] = [];

  for (const e of ENTITIES) {
    masterLines.push(
      buildLine(layout.datasets.master, layout.recordLength, {
        fileNumber: e.fileNumber,
        entityName: e.name,
        entityType: e.type,
        status: e.status,
        incorporationDate: e.inc,
        anniversaryMonth: e.anniv,
        entityStreet: e.street,
        entityCity: e.city,
        entityState: "IL",
        entityZip: e.zip,
      }),
    );
    agentLines.push(
      buildLine(layout.datasets.agent, layout.recordLength, {
        fileNumber: e.fileNumber,
        agentName: e.agent,
        agentStreet: e.street,
        agentCity: e.city,
        agentState: "IL",
        agentZip: e.zip,
      }),
    );
    if (e.president) {
      annualLines.push(
        buildLine(layout.datasets.annualReport, layout.recordLength, {
          fileNumber: e.fileNumber,
          reportYear: e.reportYear,
          presidentName: e.president,
          presidentStreet: e.street,
          presidentCity: e.city,
          presidentState: "IL",
          presidentZip: e.zip,
          secretaryName: e.secretary,
          secretaryStreet: e.street,
          secretaryCity: e.city,
          secretaryState: "IL",
          secretaryZip: e.zip,
        }),
      );
    }
  }
  // Add an older annual report for Willow Creek to exercise most-recent selection.
  annualLines.push(
    buildLine(layout.datasets.annualReport, layout.recordLength, {
      fileNumber: "00100001",
      reportYear: "2019",
      presidentName: "OLD PRESIDENT",
      presidentStreet: "120 WILLOW CREEK DR",
      presidentCity: "NAPERVILLE",
      presidentState: "IL",
      presidentZip: "60540",
      secretaryName: "OLD SECRETARY",
      secretaryStreet: "120 WILLOW CREEK DR",
      secretaryCity: "NAPERVILLE",
      secretaryState: "IL",
      secretaryZip: "60540",
    }),
  );

  writeFileSync(join(outDir, "master.txt"), masterLines.join("\n") + "\n");
  writeFileSync(join(outDir, "agent.txt"), agentLines.join("\n") + "\n");
  writeFileSync(
    join(outDir, "annual_report.txt"),
    annualLines.join("\n") + "\n",
  );
  process.stdout.write(
    `Sample data written to ${outDir}/ (${ENTITIES.length} entities)\n`,
  );
}

main();
