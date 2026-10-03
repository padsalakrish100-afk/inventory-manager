import "server-only";
import type { Permission } from "@/lib/authz";
import { periodBounds } from "@/lib/karigar/payroll";
import { APP_TIME_ZONE, todayIST } from "@/lib/dates";
import type { FilterChoice, FilterKey, Filters, ReportResult } from "@/lib/reports/types";

export type ReportContext = { showCosts: boolean };

export type ReportDef = {
  key: string;
  title: string;
  description: string;
  group: "Stock" | "Manufacturing" | "Sales" | "Finance";
  // Every listed permission is needed.
  permissions: Permission[];
  filters: FilterKey[];
  // Fills from/to with this month when they're left blank.
  defaultPeriod?: boolean;
  // Choices for report-specific filters (status, groupBy, flag, …).
  choices?: Partial<Record<FilterKey, FilterChoice[]>>;
  defaults?: Filters;
  build: (f: Filters, ctx: ReportContext) => Promise<ReportResult>;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The date range of a report: from/to (YYYY-MM-DD, India time), defaulting
// to the current month when asked to.
export function periodOf(f: Filters, fallbackToMonth: boolean): { from: string; to: string; start: Date; end: Date; label: string } | null {
  const today = todayIST();
  let from = f.from && DATE.test(f.from) ? f.from : null;
  let to = f.to && DATE.test(f.to) ? f.to : null;
  if (!from && !to && !fallbackToMonth) return null;
  from ??= fallbackToMonth ? `${today.slice(0, 8)}01` : "2000-01-01";
  to ??= today;
  if (to < from) [from, to] = [to, from];
  return { from, to, ...periodBounds(from, to), label: `${from} to ${to}` };
}

// Month key (YYYY-MM) of a date in India time, for "by month" grouping.
export function monthOf(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit" }).format(d);
}

// An amount in USD given its currency and the USD→INR rate stored with it.
export function toUsd(amount: number, currency: string, fxRate: number | null): number | null {
  if (currency === "USD") return amount;
  return fxRate ? amount / fxRate : null;
}

export const UNSOLD_STATUSES = ["POLISHED", "AT_LAB", "IN_STOCK", "ON_MEMO", "RETURNED"] as const;

export function sum<T>(items: T[], pick: (t: T) => number | null | undefined): number {
  return items.reduce((a, t) => a + (pick(t) ?? 0), 0);
}

// Groups rows by a key, keeping first-seen order.
export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) {
    const k = key(t);
    const list = out.get(k);
    if (list) list.push(t);
    else out.set(k, [t]);
  }
  return out;
}
