import {
  anniversaryMonth,
  classifyAssociation,
  composeAddress,
  titleCase,
} from "./match.js";
import type { AssociationType, Layout, Lead, MailTo, Row } from "./types.js";

export function isNfp(master: Row, layout: Layout): boolean {
  const type = (master.entityType ?? "").toUpperCase();
  return layout.nfpEntityTypes.map((t) => t.toUpperCase()).includes(type);
}

export function isActive(status: string, layout: Layout): boolean {
  const s = status.toUpperCase();
  if (layout.inactiveStatuses.map((x) => x.toUpperCase()).includes(s))
    return false;
  // If an active list is defined, require membership; otherwise treat as active.
  if (layout.activeStatuses.length === 0) return true;
  return layout.activeStatuses.map((x) => x.toUpperCase()).includes(s);
}

// A master row is a target if it is an NFP whose name classifies as an association.
// Returns the association type, or null if not a target.
export function targetType(
  master: Row,
  layout: Layout,
): AssociationType | null {
  if (!isNfp(master, layout)) return null;
  return classifyAssociation(master.entityName ?? "");
}

// Build a finished Lead from the joined rows. agent/annual may be undefined.
export function buildLead(
  master: Row,
  agent: Row | undefined,
  annual: Row | undefined,
  type: AssociationType,
  mailTo: MailTo,
): Lead {
  const entityStreet = titleCase(master.entityStreet ?? "");
  const entityAddress = composeAddress(
    master.entityStreet ?? "",
    master.entityCity ?? "",
    master.entityState ?? "",
    master.entityZip ?? "",
  );
  const agentAddress = agent
    ? composeAddress(
        agent.agentStreet ?? "",
        agent.agentCity ?? "",
        agent.agentState ?? "",
        agent.agentZip ?? "",
      )
    : "";
  const presidentName = annual ? titleCase(annual.presidentName ?? "") : "";
  const presidentAddress = annual
    ? composeAddress(
        annual.presidentStreet ?? "",
        annual.presidentCity ?? "",
        annual.presidentState ?? "",
        annual.presidentZip ?? "",
      )
    : "";
  const secretaryName = annual ? titleCase(annual.secretaryName ?? "") : "";
  const secretaryAddress = annual
    ? composeAddress(
        annual.secretaryStreet ?? "",
        annual.secretaryCity ?? "",
        annual.secretaryState ?? "",
        annual.secretaryZip ?? "",
      )
    : "";
  const entityName = titleCase(master.entityName ?? "");

  const { mailToName, mailToAddress } = pickMailTarget(
    mailTo,
    entityName,
    entityAddress,
    agentAddress,
    presidentName,
    presidentAddress,
  );

  return {
    fileNumber: master.fileNumber ?? "",
    entityName,
    associationType: type,
    status: (master.status ?? "").toUpperCase(),
    mailToName,
    mailToAddress,
    entityStreet,
    entityCity: titleCase(master.entityCity ?? ""),
    entityState: (master.entityState ?? "").toUpperCase(),
    entityZip: master.entityZip ?? "",
    presidentName,
    presidentAddress,
    secretaryName,
    secretaryAddress,
    agentName: agent ? titleCase(agent.agentName ?? "") : "",
    agentAddress,
    incorporationDate: master.incorporationDate ?? "",
    anniversaryMonth: anniversaryMonth(
      master.anniversaryMonth ?? "",
      master.incorporationDate ?? "",
    ),
  };
}

// Default: mail the board at the entity address (fallback to the registered
// agent's address if the entity has none). --mail-to officer targets the president.
function pickMailTarget(
  mailTo: MailTo,
  entityName: string,
  entityAddress: string,
  agentAddress: string,
  presidentName: string,
  presidentAddress: string,
): { mailToName: string; mailToAddress: string } {
  if (mailTo === "officer" && presidentName && presidentAddress) {
    return { mailToName: presidentName, mailToAddress: presidentAddress };
  }
  return {
    mailToName: `Board of Directors, ${entityName}`,
    mailToAddress: entityAddress || agentAddress,
  };
}

// Keep the most recent of two annual-report rows per the layout's recency field.
export function moreRecent(
  a: Row | undefined,
  b: Row,
  recencyField: string,
): Row {
  if (!a) return b;
  const av = parseInt(a[recencyField] ?? "", 10) || 0;
  const bv = parseInt(b[recencyField] ?? "", 10) || 0;
  return bv >= av ? b : a;
}
