import "server-only";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/dates";
import { getStages } from "@/lib/process-stages";
import { usdInrOn } from "@/lib/fx";
import { inventoryValuation } from "@/lib/costing/valuation";
import { openReceivables } from "@/lib/sales/balances";
import { ageingBucket } from "@/lib/sales/constants";
import { daysSince } from "@/lib/dates";
import { profitReport, salesReport } from "@/lib/reports/sales";

// Data for the home dashboard. Each loader is called only for viewers who
// may see that card.

export async function stageCounts() {
  const [stages, out, byStatus] = await Promise.all([
    getStages(),
    prisma.processMovement.groupBy({ by: ["stageId"], where: { returnDate: null, voidedAt: null }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const outBy = new Map(out.map((o) => [o.stageId, o._count._all]));
  return {
    stages: stages.filter((s) => s.active || outBy.has(s.id)).map((s) => ({ id: s.id, name: s.name, count: outBy.get(s.id) ?? 0 })),
    unstaged: outBy.get(null) ?? 0,
    byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])) as Record<string, number>,
  };
}

export async function pendingSummary() {
  const setting = await prisma.setting.findUnique({ where: { id: "singleton" }, select: { pendingAlertDays: true } });
  const alertDays = setting?.pendingAlertDays ?? 7;
  const where = { returnDate: null, voidedAt: null };
  const [total, overdue, byParty] = await Promise.all([
    prisma.processMovement.count({ where }),
    prisma.processMovement.count({ where: { ...where, issueDate: { lt: daysAgo(alertDays) } } }),
    prisma.processMovement.groupBy({ by: ["partyId"], where: { ...where, partyId: { not: null } }, _count: { _all: true }, orderBy: { _count: { partyId: "desc" } }, take: 5 }),
  ]);
  const parties = await prisma.party.findMany({ where: { id: { in: byParty.map((b) => b.partyId!) } }, select: { id: true, name: true } });
  const name = new Map(parties.map((p) => [p.id, p.name]));
  return { total, overdue, alertDays, top: byParty.map((b) => ({ id: b.partyId!, name: name.get(b.partyId!) ?? "—", count: b._count._all })) };
}

export async function excessAlerts() {
  const where = { isExcessLoss: true, voidedAt: null, excessReviewedAt: null };
  const [count, latest] = await Promise.all([
    prisma.processMovement.count({ where }),
    prisma.processMovement.findMany({
      where,
      orderBy: { returnDate: "desc" },
      take: 3,
      select: { id: true, lossPct: true, lossLimitPct: true, returnDate: true, product: { select: { id: true, sku: true } }, party: { select: { name: true } }, stage: { select: { name: true } } },
    }),
  ]);
  return { count, latest };
}

export async function overdueMemos() {
  const now = new Date();
  const memos = await prisma.salesMemo.findMany({
    where: { voidedAt: null, status: { in: ["OPEN", "PARTIAL"] }, dueDate: { lt: now } },
    include: { party: { select: { name: true } }, lines: { where: { status: "OUT" }, select: { amount: true } } },
    orderBy: { dueDate: "asc" },
    take: 50,
  });
  const out = await prisma.salesMemoLine.count({ where: { status: "OUT", memo: { voidedAt: null } } });
  return {
    count: memos.length,
    stonesOut: out,
    list: memos.slice(0, 5).map((m) => ({
      id: m.id,
      memoNo: m.memoNo,
      party: m.party.name,
      dueDate: m.dueDate,
      days: daysSince(m.dueDate, now),
      value: m.lines.reduce((a, l) => a + Number(l.amount), 0),
      currency: m.currency,
    })),
  };
}

export async function stockValue() {
  const fx = await usdInrOn(prisma, new Date());
  const rows = await inventoryValuation({}, fx ? Number(fx) : null);
  const pick = (r: (typeof rows)[number][]) => ({
    stones: r.reduce((a, x) => a + x.stones, 0),
    carats: r.reduce((a, x) => a + x.carats, 0),
    costUsd: r.reduce((a, x) => a + x.costUsd, 0),
    askingUsd: r.reduce((a, x) => a + x.askingUsd, 0),
    unpriced: r.reduce((a, x) => a + x.unpriced, 0),
  });
  return {
    polished: pick(rows.filter((r) => r.status !== "IN_PRODUCTION")),
    wip: pick(rows.filter((r) => r.status === "IN_PRODUCTION")),
    fx,
  };
}

export async function monthSales(showCosts: boolean) {
  const r = showCosts ? await profitReport.build({}, { showCosts: true }) : await salesReport.build({}, { showCosts: false });
  const t = r.totals ?? {};
  return {
    stones: r.rows.length,
    carats: Number(t.carats ?? 0),
    salesUsd: Number(t.amountUsd ?? 0),
    profitUsd: showCosts ? Number(t.profitUsd ?? 0) : null,
    margin: showCosts && t.margin !== null && t.margin !== undefined ? Number(t.margin) : null,
  };
}

export async function receivablesSummary() {
  const docs = await openReceivables(prisma);
  const now = new Date();
  const by = new Map<string, { outstanding: number; overdue: number; over90: number; invoices: number }>();
  for (const d of docs) {
    const s = by.get(d.currency) ?? { outstanding: 0, overdue: 0, over90: 0, invoices: 0 };
    s.outstanding += d.outstandingCents / 100;
    if (d.dueDate && d.dueDate < now) s.overdue += d.outstandingCents / 100;
    if (ageingBucket(daysSince(d.date, now)) === "d90") s.over90 += d.outstandingCents / 100;
    s.invoices++;
    by.set(d.currency, s);
  }
  return [...by.entries()].map(([currency, s]) => ({ currency, ...s }));
}
