import "server-only";
import { prisma } from "@/lib/prisma";
import { daysSince, formatDate } from "@/lib/dates";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { stoneCosts } from "@/lib/costing/ledger";
import { MEMO_LINE_LABELS } from "@/lib/sales/constants";
import { r2, r3 } from "@/lib/reports/format";
import type { Filters, ReportColumn, ReportResult, ReportRow } from "@/lib/reports/types";
import { groupBy, monthOf, periodOf, sum, toUsd, type ReportContext, type ReportDef } from "@/lib/reports/common";

const SALES_GROUPS = [
  { value: "", label: "Each stone" },
  { value: "customer", label: "Customer" },
  { value: "month", label: "Month" },
  { value: "cut", label: "Cut style" },
];

// Invoice lines (not voided) in the period, with USD value, cost and
// brokerage share — the base of the sales and profit reports.
async function saleLines(f: Filters, ctx: ReportContext, withCost: boolean) {
  const period = periodOf(f, true)!;
  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { voidedAt: null, date: { gte: period.start, lt: period.end }, ...(f.party ? { partyId: f.party } : {}) },
      ...(f.cutStyle || f.shape
        ? {
            stone: {
              polishedStone: {
                ...(f.cutStyle ? { cutStyle: f.cutStyle } : {}),
                ...(f.shape ? { shape: { equals: f.shape, mode: "insensitive" as const } } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      invoice: {
        select: { id: true, invoiceNo: true, date: true, currency: true, fxRate: true, subtotal: true, brokerageAmount: true, party: { select: { name: true } } },
      },
      stone: { select: { sku: true, polishedStone: { select: { id: true, stockId: true, cutStyle: true } } } },
    },
    orderBy: [{ invoice: { date: "asc" } }, { invoice: { invoiceNo: "asc" } }],
    take: 20000,
  });
  const live = withCost && ctx.showCosts ? await stoneCosts(prisma, lines.filter((l) => l.costUsd === null).map((l) => l.stoneId)) : null;
  const rows = lines.map((l) => {
    const fx = l.invoice.fxRate ? Number(l.invoice.fxRate) : null;
    const amount = Number(l.amount);
    const amountUsd = toUsd(amount, l.invoice.currency, fx);
    const subtotal = Number(l.invoice.subtotal);
    const brokerage = l.invoice.brokerageAmount && subtotal > 0 ? (Number(l.invoice.brokerageAmount) * amount) / subtotal : 0;
    const brokerageUsd = toUsd(brokerage, l.invoice.currency, fx);
    const costUsd = !(withCost && ctx.showCosts) ? null : l.costUsd !== null ? Number(l.costUsd) : (live!.get(l.stoneId)?.usdCents ?? 0) / 100;
    return {
      l,
      amount,
      amountUsd,
      brokerageUsd,
      costUsd,
      profitUsd: costUsd !== null && amountUsd !== null && brokerageUsd !== null ? amountUsd - costUsd - brokerageUsd : null,
      cut: l.stone.polishedStone?.cutStyle ? (CUT_STYLE_LABELS[l.stone.polishedStone.cutStyle] ?? l.stone.polishedStone.cutStyle) : "Not set",
    };
  });
  return { period, rows };
}

type SaleRow = Awaited<ReturnType<typeof saleLines>>["rows"][number];

function groupKey(f: Filters, r: SaleRow): string {
  if (f.groupBy === "customer") return r.l.invoice.party.name;
  if (f.groupBy === "month") return monthOf(r.l.invoice.date);
  return r.cut;
}

function aggregate(g: SaleRow[], profit: boolean) {
  const sale = sum(g, (r) => r.amountUsd);
  const cost = sum(g, (r) => r.costUsd);
  const prof = sum(g, (r) => r.profitUsd);
  return {
    stones: g.length,
    carats: r3(sum(g, (r) => Number(r.l.carats))),
    amountUsd: r2(sale),
    ...(profit
      ? {
          costUsd: r2(cost),
          brokerageUsd: r2(sum(g, (r) => r.brokerageUsd)),
          profitUsd: r2(prof),
          onCost: cost > 0 ? r2((prof / cost) * 100) : null,
          margin: sale > 0 ? r2((prof / sale) * 100) : null,
        }
      : {}),
  };
}

async function buildSales(f: Filters, ctx: ReportContext, profit: boolean): Promise<ReportResult> {
  const { period, rows } = await saleLines(f, ctx, profit);
  const title = profit ? "Profit report" : "Sales report";
  const subtitle = `Invoices ${period.label}`;
  const notes = [
    "Amounts in USD at each invoice's exchange rate.",
    ...(profit ? ["Profit = sale - cost when sold - brokerage. Older sales without a frozen cost use the current cost ledger."] : []),
  ];
  const profitCols: ReportColumn[] = profit
    ? [
        { key: "costUsd", header: "Cost (USD)", kind: "money", currency: "USD", costOnly: true },
        { key: "brokerageUsd", header: "Brokerage (USD)", kind: "money", currency: "USD", costOnly: true },
        { key: "profitUsd", header: "Profit (USD)", kind: "money", currency: "USD", costOnly: true },
        { key: "onCost", header: "On cost %", kind: "pct", costOnly: true },
        { key: "margin", header: "Margin %", kind: "pct", costOnly: true },
      ]
    : [];

  if (f.groupBy) {
    return {
      title,
      subtitle,
      columns: [
        { key: "group", header: f.groupBy === "customer" ? "Customer" : f.groupBy === "month" ? "Month" : "Cut style", width: 26 },
        { key: "stones", header: "Stones", kind: "int" },
        { key: "carats", header: "Carats", kind: "carat" },
        { key: "amountUsd", header: "Sales (USD)", kind: "money", currency: "USD" },
        ...profitCols,
      ] satisfies ReportColumn[],
      rows: [...groupBy(rows, (r) => groupKey(f, r)).entries()]
        .sort((a, b) => (f.groupBy === "month" ? a[0].localeCompare(b[0]) : sum(b[1], (r) => r.amountUsd) - sum(a[1], (r) => r.amountUsd)))
        .map(([group, g]) => ({ group, ...aggregate(g, profit) })),
      totals: { group: "Total", ...aggregate(rows, profit) },
      notes,
    };
  }

  return {
    title,
    subtitle,
    columns: [
      { key: "date", header: "Date" },
      { key: "invoiceNo", header: "Invoice", hrefKey: "invoiceHref" },
      { key: "customer", header: "Customer", width: 26 },
      { key: "stockId", header: "Stock ID", hrefKey: "stoneHref" },
      { key: "description", header: "Description", width: 30 },
      { key: "carats", header: "Carats", kind: "carat" },
      { key: "amount", header: "Amount", kind: "money", currencyKey: "currency" },
      { key: "currency", header: "Cur." },
      { key: "amountUsd", header: "Amount (USD)", kind: "money", currency: "USD" },
      ...profitCols,
    ] satisfies ReportColumn[],
    rows: rows.map((r): ReportRow => {
      const sale = r.amountUsd;
      return {
        date: formatDate(r.l.invoice.date),
        invoiceNo: r.l.invoice.invoiceNo,
        invoiceHref: `/sales/invoices/${r.l.invoice.id}`,
        customer: r.l.invoice.party.name,
        stockId: r.l.stone.polishedStone?.stockId ?? r.l.stone.sku,
        stoneHref: r.l.stone.polishedStone ? `/polish/${r.l.stone.polishedStone.id}` : null,
        description: r.l.description ?? "",
        carats: Number(r.l.carats),
        amount: r.amount,
        currency: r.l.invoice.currency,
        amountUsd: sale !== null ? r2(sale) : null,
        ...(profit
          ? {
              costUsd: r.costUsd !== null ? r2(r.costUsd) : null,
              brokerageUsd: r.brokerageUsd !== null ? r2(r.brokerageUsd) : null,
              profitUsd: r.profitUsd !== null ? r2(r.profitUsd) : null,
              onCost: r.profitUsd !== null && r.costUsd ? r2((r.profitUsd / r.costUsd) * 100) : null,
              margin: r.profitUsd !== null && sale ? r2((r.profitUsd / sale) * 100) : null,
            }
          : {}),
      };
    }),
    totals: (() => {
      const t = aggregate(rows, profit);
      return { date: "Total", invoiceNo: `${t.stones} stones`, ...t, stones: null };
    })(),
    notes,
  };
}

export const salesReport: ReportDef = {
  key: "sales",
  title: "Sales report",
  description: "Every stone invoiced in a period, or totals by customer, month or cut — in USD.",
  group: "Sales",
  permissions: ["sales.reports", "sales.manage"],
  filters: ["from", "to", "party", "cutStyle", "shape", "groupBy"],
  defaultPeriod: true,
  choices: { groupBy: SALES_GROUPS },
  build: (f, ctx) => buildSales(f, ctx, false),
};

export const profitReport: ReportDef = {
  key: "profit",
  title: "Profit report",
  description: "Sales against cost and brokerage: profit and margin per stone, customer, month or cut.",
  group: "Sales",
  permissions: ["sales.reports", "sales.manage", "costs.view"],
  filters: ["from", "to", "party", "cutStyle", "shape", "groupBy"],
  defaultPeriod: true,
  choices: { groupBy: SALES_GROUPS },
  build: (f, ctx) => buildSales(f, ctx, true),
};

export const memoReport: ReportDef = {
  key: "memos",
  title: "Memo report",
  description: "Stones on memo by customer — what's out, for how long, and what came back or sold.",
  group: "Sales",
  permissions: ["memo.manage"],
  filters: ["from", "to", "party", "lineStatus", "flag"],
  defaults: { lineStatus: "OUT" },
  choices: {
    lineStatus: [
      { value: "", label: "All lines" },
      { value: "OUT", label: "Still out" },
      { value: "RETURNED", label: "Returned" },
      { value: "SOLD", label: "Sold" },
    ],
    flag: [
      { value: "", label: "Any due date" },
      { value: "overdue", label: "Overdue only" },
    ],
  },
  async build(f): Promise<ReportResult> {
    const period = periodOf(f, false);
    const now = new Date();
    const lineStatus = f.flag === "overdue" ? "OUT" : f.lineStatus;
    const lines = await prisma.salesMemoLine.findMany({
      where: {
        ...(lineStatus ? { status: lineStatus } : {}),
        memo: {
          voidedAt: null,
          ...(period ? { date: { gte: period.start, lt: period.end } } : {}),
          ...(f.party ? { partyId: f.party } : {}),
          ...(f.flag === "overdue" ? { dueDate: { lt: now } } : {}),
        },
      },
      include: {
        memo: { select: { id: true, memoNo: true, date: true, dueDate: true, currency: true, party: { select: { name: true } } } },
        stone: { select: { sku: true, polishedStone: { select: { id: true, stockId: true } } } },
      },
      orderBy: [{ memo: { date: "asc" } }, { memo: { memoNo: "asc" } }],
      take: 20000,
    });
    const byCurrency = groupBy(lines, (l) => l.memo.currency);
    return {
      title: "Memo report",
      subtitle: [
        period ? `Memos ${period.label}` : "All memos",
        lineStatus ? MEMO_LINE_LABELS[lineStatus] : "all lines",
        f.flag === "overdue" ? "overdue" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      columns: [
        { key: "memoNo", header: "Memo", hrefKey: "memoHref" },
        { key: "date", header: "Date" },
        { key: "due", header: "Due" },
        { key: "days", header: "Days out", kind: "int" },
        { key: "customer", header: "Customer", width: 26 },
        { key: "stockId", header: "Stock ID", hrefKey: "stoneHref" },
        { key: "carats", header: "Carats", kind: "carat" },
        { key: "amount", header: "Memo price", kind: "money", currencyKey: "currency" },
        { key: "currency", header: "Cur." },
        { key: "status", header: "Status" },
      ],
      rows: lines.map((l): ReportRow => {
        const overdue = l.status === "OUT" && l.memo.dueDate < now;
        return {
          memoNo: l.memo.memoNo,
          memoHref: `/sales/memos/${l.memo.id}`,
          date: formatDate(l.memo.date),
          due: formatDate(l.memo.dueDate) + (overdue ? " (overdue)" : ""),
          days: l.status === "OUT" ? daysSince(l.memo.date, now) : null,
          customer: l.memo.party.name,
          stockId: l.stone.polishedStone?.stockId ?? l.stone.sku,
          stoneHref: l.stone.polishedStone ? `/polish/${l.stone.polishedStone.id}` : null,
          carats: Number(l.carats),
          amount: Number(l.amount),
          currency: l.memo.currency,
          status: (MEMO_LINE_LABELS[l.status] ?? l.status) + (l.returnedAt ? ` ${formatDate(l.returnedAt)}` : ""),
        };
      }),
      totals: { memoNo: `${lines.length} stones`, carats: r3(sum(lines, (l) => Number(l.carats))) },
      notes: [...byCurrency.entries()].map(([cur, g]) => `Total ${cur}: ${r2(sum(g, (l) => Number(l.amount))).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`),
    };
  },
};
