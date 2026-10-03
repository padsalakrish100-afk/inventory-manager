import "server-only";
import { prisma } from "@/lib/prisma";
import { daysSince, formatDate } from "@/lib/dates";
import { AGEING_BUCKETS, ageingBucket } from "@/lib/sales/constants";
import { openPayables, openReceivables, type OpenDocument } from "@/lib/sales/balances";
import { r2 } from "@/lib/reports/format";
import type { Filters, ReportColumn, ReportResult, ReportRow } from "@/lib/reports/types";
import { groupBy, sum, type ReportDef } from "@/lib/reports/common";

const KIND_LABELS: Record<OpenDocument["kind"], string> = {
  INVOICE: "Invoice",
  ROUGH: "Rough purchase",
  JOB_WORK: "Job-work bill",
  BROKERAGE: "Brokerage",
};

function href(d: OpenDocument): string | null {
  if (d.kind === "INVOICE" || d.kind === "BROKERAGE") return `/sales/invoices/${d.id}`;
  if (d.kind === "ROUGH") return `/rough/${d.id}`;
  return null;
}

// Open documents as an ageing report: one line each, or per party and
// currency with the 0–30 / 31–60 / 61–90 / 90+ buckets.
function ageing(title: string, docs: OpenDocument[], f: Filters): ReportResult {
  const now = new Date();
  const docsIn = docs.filter((d) => (!f.party || d.partyId === f.party) && (!f.currency || d.currency === f.currency) && (!f.kind || d.kind === f.kind));
  const currencies = [...new Set(docsIn.map((d) => d.currency))];
  const notes = currencies.map((cur) => {
    const g = docsIn.filter((d) => d.currency === cur);
    return `Outstanding ${cur}: ${r2(sum(g, (d) => d.outstandingCents) / 100).toLocaleString(cur === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2 })}`;
  });

  if (f.groupBy === "party") {
    const bucketCols: ReportColumn[] = AGEING_BUCKETS.map((b) => ({ key: b.key, header: `${b.label} days`, kind: "money", currencyKey: "currency" }));
    return {
      title,
      subtitle: "By party · days since the document date",
      columns: [{ key: "party", header: "Party", width: 28 }, { key: "currency", header: "Cur." }, { key: "docs", header: "Documents", kind: "int" }, ...bucketCols, { key: "total", header: "Total", kind: "money", currencyKey: "currency" }],
      rows: [...groupBy(docsIn, (d) => `${d.partyName}\u0000${d.currency}`).values()]
        .map((g) => {
          const row: ReportRow = { party: g[0].partyName, currency: g[0].currency, docs: g.length, total: r2(sum(g, (d) => d.outstandingCents) / 100) };
          for (const b of AGEING_BUCKETS) row[b.key] = r2(sum(g.filter((d) => ageingBucket(daysSince(d.date, now)) === b.key), (d) => d.outstandingCents) / 100) || null;
          return row;
        })
        .sort((a, b) => String(a.currency).localeCompare(String(b.currency)) || Number(b.total) - Number(a.total)),
      notes,
    };
  }

  return {
    title,
    subtitle: "Each open document, oldest first · days since the document date",
    columns: [
      { key: "kind", header: "Type" },
      { key: "ref", header: "Document", hrefKey: "href", width: 24 },
      { key: "party", header: "Party", width: 26 },
      { key: "date", header: "Date" },
      { key: "due", header: "Due" },
      { key: "days", header: "Days", kind: "int" },
      { key: "bucket", header: "Age" },
      { key: "currency", header: "Cur." },
      { key: "total", header: "Total", kind: "money", currencyKey: "currency" },
      { key: "paid", header: "Paid", kind: "money", currencyKey: "currency" },
      { key: "outstanding", header: "Outstanding", kind: "money", currencyKey: "currency" },
    ],
    rows: docsIn.map((d): ReportRow => {
      const days = daysSince(d.date, now);
      return {
        kind: KIND_LABELS[d.kind],
        ref: d.ref,
        href: href(d),
        party: d.partyName,
        date: formatDate(d.date),
        due: d.dueDate ? formatDate(d.dueDate) + (d.dueDate < now ? " (overdue)" : "") : "",
        days,
        bucket: AGEING_BUCKETS.find((b) => b.key === ageingBucket(days))!.label,
        currency: d.currency,
        total: d.totalCents / 100,
        paid: d.paidCents / 100,
        outstanding: d.outstandingCents / 100,
      };
    }),
    totals: { kind: `${docsIn.length} open` },
    notes,
  };
}

const GROUPS = [
  { value: "", label: "Each document" },
  { value: "party", label: "Party (ageing buckets)" },
];
const CURRENCIES = [
  { value: "USD", label: "USD" },
  { value: "INR", label: "INR" },
];

export const receivablesReport: ReportDef = {
  key: "receivables",
  title: "Receivables",
  description: "What customers owe: open invoices with ageing (0–30, 31–60, 61–90, 90+ days).",
  group: "Finance",
  permissions: ["sales.manage"],
  filters: ["party", "currency", "groupBy"],
  choices: { groupBy: GROUPS, currency: CURRENCIES },
  build: async (f) => ageing("Receivables", await openReceivables(prisma), f),
};

export const payablesReport: ReportDef = {
  key: "payables",
  title: "Payables",
  description: "What we owe vendors, job-workers and brokers, with ageing.",
  group: "Finance",
  permissions: ["costs.view"],
  filters: ["party", "kind", "currency", "groupBy"],
  choices: {
    groupBy: GROUPS,
    currency: CURRENCIES,
    kind: [
      { value: "ROUGH", label: "Rough purchases" },
      { value: "JOB_WORK", label: "Job-work bills" },
      { value: "BROKERAGE", label: "Brokerage" },
    ],
  },
  build: async (f) => ageing("Payables", await openPayables(prisma), f),
};
