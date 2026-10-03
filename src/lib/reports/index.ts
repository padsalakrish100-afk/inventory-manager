import "server-only";
import { can, type Viewer } from "@/lib/authz";
import type { FilterKey, Filters, ReportResult } from "@/lib/reports/types";
import type { ReportDef } from "@/lib/reports/common";
import { stockAging, stockList } from "@/lib/reports/stock";
import { lossReport, yieldReport } from "@/lib/reports/manufacturing";
import { memoReport, profitReport, salesReport } from "@/lib/reports/sales";
import { payablesReport, receivablesReport } from "@/lib/reports/finance";

export const REPORTS: ReportDef[] = [
  stockList,
  stockAging,
  lossReport,
  yieldReport,
  salesReport,
  profitReport,
  memoReport,
  receivablesReport,
  payablesReport,
];

export const REPORTS_BY_KEY = new Map(REPORTS.map((r) => [r.key, r]));

export function canRun(viewer: Viewer, def: ReportDef): boolean {
  return def.permissions.every((p) => can(viewer, p));
}

const FILTER_KEYS: FilterKey[] = [
  "from", "to", "party", "karigar", "stage", "lot", "shape", "cutStyle", "status", "location", "lineStatus", "kind", "currency", "flag", "groupBy",
];

// The report's own filters from a query string (anything else is ignored),
// with its defaults filled in; values are trimmed and length-capped.
export function readFilters(def: ReportDef, get: (key: string) => string | null | undefined): Filters {
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    if (!def.filters.includes(k)) continue;
    const raw = get(k);
    const v = raw === null || raw === undefined ? def.defaults?.[k] : raw.trim().slice(0, 64);
    if (!v) continue;
    const choices = def.choices?.[k];
    if (choices && !choices.some((c) => c.value === v)) continue;
    f[k] = v;
  }
  return f;
}

// Runs a report for a viewer and strips cost-only columns for anyone who
// can't see costs (the builders also skip computing them).
export async function runReport(viewer: Viewer, def: ReportDef, f: Filters): Promise<ReportResult> {
  const showCosts = can(viewer, "costs.view");
  const result = await def.build(f, { showCosts });
  if (showCosts) return result;
  const hidden = new Set(result.columns.filter((c) => c.costOnly).map((c) => c.key));
  const strip = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([k]) => !hidden.has(k)));
  return {
    ...result,
    columns: result.columns.filter((c) => !c.costOnly),
    rows: result.rows.map((r) => strip(r) as typeof r),
    totals: result.totals ? (strip(result.totals) as typeof result.totals) : undefined,
  };
}
