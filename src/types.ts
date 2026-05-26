// Shared types for the Illinois association lead extractor.

export type FieldSpec = [start: number, length: number]; // 1-based start column

export interface DatasetSource {
  file?: string; // dedicated file for this dataset (separate-file distribution)
  recordType?: { start: number; length: number; value: string }; // combined-file discriminator
}

export interface DatasetLayout {
  source: DatasetSource;
  recencyField?: string; // field used to keep the most recent row per file number
  fields: Record<string, FieldSpec>;
}

export interface Layout {
  state: string;
  label: string;
  specNote: string;
  recordLength: number;
  nfpEntityTypes: string[];
  activeStatuses: string[];
  inactiveStatuses: string[];
  combinedFile: string | null;
  datasets: {
    master: DatasetLayout;
    agent: DatasetLayout;
    annualReport: DatasetLayout;
    [key: string]: DatasetLayout;
  };
}

// A parsed row: field name -> trimmed string value.
export type Row = Record<string, string>;

export type AssociationType = "condo" | "townhome" | "homeowner" | "other";

export interface Lead {
  fileNumber: string;
  entityName: string;
  associationType: AssociationType;
  status: string;
  mailToName: string;
  mailToAddress: string;
  entityStreet: string;
  entityCity: string;
  entityState: string;
  entityZip: string;
  presidentName: string;
  presidentAddress: string;
  secretaryName: string;
  secretaryAddress: string;
  agentName: string;
  agentAddress: string;
  incorporationDate: string;
  anniversaryMonth: string;
}

export type MailTo = "entity" | "officer";
