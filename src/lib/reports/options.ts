import "server-only";
import { prisma } from "@/lib/prisma";
import { getStages } from "@/lib/process-stages";
import { CUT_STYLES } from "@/lib/cuts";
import type { FilterChoice, FilterKey } from "@/lib/reports/types";
import type { ReportDef } from "@/lib/reports/common";
import type { PartyRoleType } from "@/generated/prisma/client";

// Which parties a report's "party" filter lists.
const PARTY_ROLES: Record<string, PartyRoleType[]> = {
  sales: ["CUSTOMER"],
  profit: ["CUSTOMER"],
  memos: ["CUSTOMER"],
  receivables: ["CUSTOMER"],
  payables: ["VENDOR", "JOB_WORKER", "BROKER"],
};

// Dropdown choices for every filter a report uses.
export async function filterOptions(def: ReportDef): Promise<Partial<Record<FilterKey, FilterChoice[]>>> {
  const out: Partial<Record<FilterKey, FilterChoice[]>> = { ...def.choices };
  const has = (k: FilterKey) => def.filters.includes(k) && !def.choices?.[k];

  const tasks: Promise<void>[] = [];
  if (has("party")) {
    tasks.push(
      prisma.party
        .findMany({ where: { roles: { hasSome: PARTY_ROLES[def.key] ?? ["CUSTOMER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
        .then((ps) => void (out.party = ps.map((p) => ({ value: p.id, label: p.name })))),
    );
  }
  if (has("karigar")) {
    tasks.push(
      prisma.party
        .findMany({ where: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
        .then((ps) => void (out.karigar = ps.map((p) => ({ value: p.id, label: p.name })))),
    );
  }
  if (has("stage")) tasks.push(getStages().then((st) => void (out.stage = st.map((s) => ({ value: s.id, label: s.name })))));
  if (has("lot")) {
    tasks.push(
      prisma.lot
        .findMany({ select: { id: true, lotNumber: true }, orderBy: { createdAt: "desc" }, take: 500 })
        .then((ls) => void (out.lot = ls.map((l) => ({ value: l.id, label: l.lotNumber })))),
    );
  }
  if (has("shape")) {
    tasks.push(
      prisma.polishedStone
        .findMany({ where: { shape: { not: null } }, distinct: ["shape"], select: { shape: true }, orderBy: { shape: "asc" } })
        .then((ss) => void (out.shape = ss.map((s) => ({ value: s.shape!, label: s.shape! })))),
    );
  }
  if (has("cutStyle")) out.cutStyle = CUT_STYLES.map((c) => ({ value: c.value, label: c.label }));
  await Promise.all(tasks);
  return out;
}

export const FILTER_LABELS: Record<FilterKey, string> = {
  from: "From",
  to: "To",
  party: "Party",
  karigar: "Karigar",
  stage: "Stage",
  lot: "Lot",
  shape: "Shape",
  cutStyle: "Cut style",
  status: "Status",
  location: "Location",
  lineStatus: "Lines",
  kind: "Type",
  currency: "Currency",
  flag: "Show",
  groupBy: "Group by",
};
