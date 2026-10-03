import "server-only";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { toCents } from "@/lib/money";
import type { PayState } from "@/lib/sales/constants";

type Db = Tx | typeof prisma;

export function payState(totalCents: number, paidCents: number): PayState {
  if (paidCents <= 0) return "UNPAID";
  return paidCents >= totalCents ? "PAID" : "PARTIAL";
}

type Target = "invoiceId" | "roughPurchaseId" | "jobWorkBillId";

// Sum of live (not voided) allocations per document, in cents.
async function allocated(db: Db, target: Target, ids: string[], direction: "IN" | "OUT"): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const rows = await db.paymentAllocation.groupBy({
    by: [target],
    where: { [target]: { in: ids }, payment: { voidedAt: null, direction } },
    _sum: { amount: true },
  });
  for (const r of rows) {
    const id = r[target];
    if (id) out.set(id, toCents(r._sum.amount ?? 0));
  }
  return out;
}

// Money received against each invoice (IN), and brokerage paid out on it (OUT).
export async function invoicePayments(
  db: Db,
  invoiceIds: string[],
): Promise<Map<string, { receivedCents: number; brokeragePaidCents: number }>> {
  const [received, brokerage] = await Promise.all([
    allocated(db, "invoiceId", invoiceIds, "IN"),
    allocated(db, "invoiceId", invoiceIds, "OUT"),
  ]);
  return new Map(
    invoiceIds.map((id) => [id, { receivedCents: received.get(id) ?? 0, brokeragePaidCents: brokerage.get(id) ?? 0 }]),
  );
}

export type OpenDocument = {
  kind: "INVOICE" | "ROUGH" | "JOB_WORK" | "BROKERAGE";
  id: string;
  ref: string;
  partyId: string;
  partyName: string;
  date: Date;
  dueDate: Date | null;
  currency: string;
  fxRate: string | null;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
};

// Unpaid and part-paid invoices.
export async function openReceivables(db: Db, filter: { partyId?: string } = {}): Promise<OpenDocument[]> {
  const invoices = await db.invoice.findMany({
    where: { voidedAt: null, partyId: filter.partyId },
    select: { id: true, invoiceNo: true, partyId: true, party: { select: { name: true } }, date: true, dueDate: true, currency: true, fxRate: true, total: true },
    orderBy: { date: "asc" },
  });
  const paid = await allocated(db, "invoiceId", invoices.map((i) => i.id), "IN");
  return invoices
    .map((i): OpenDocument => {
      const totalCents = toCents(i.total);
      const paidCents = paid.get(i.id) ?? 0;
      return {
        kind: "INVOICE",
        id: i.id,
        ref: i.invoiceNo,
        partyId: i.partyId,
        partyName: i.party.name,
        date: i.date,
        dueDate: i.dueDate,
        currency: i.currency,
        fxRate: i.fxRate?.toString() ?? null,
        totalCents,
        paidCents,
        outstandingCents: totalCents - paidCents,
      };
    })
    .filter((d) => d.outstandingCents > 0);
}

// What we owe: rough purchases (vendors), job-work bills, and brokerage on
// invoices (brokers).
export async function openPayables(db: Db, filter: { partyId?: string } = {}): Promise<OpenDocument[]> {
  const [rough, bills, brokered] = await Promise.all([
    db.roughPurchase.findMany({
      where: { voidedAt: null, partyId: filter.partyId },
      select: { id: true, purchaseNo: true, invoiceNo: true, partyId: true, party: { select: { name: true } }, date: true, dueDate: true, currency: true, fxRate: true, totalAmount: true },
    }),
    db.jobWorkBill.findMany({
      where: { voidedAt: null, partyId: filter.partyId },
      select: { id: true, billNo: true, partyId: true, party: { select: { name: true } }, date: true, currency: true, fxRate: true, amount: true },
    }),
    db.invoice.findMany({
      where: { voidedAt: null, brokerId: filter.partyId ?? { not: null }, brokerageAmount: { gt: 0 } },
      select: { id: true, invoiceNo: true, brokerId: true, broker: { select: { name: true } }, date: true, currency: true, fxRate: true, brokerageAmount: true },
    }),
  ]);
  const [roughPaid, billPaid, brokeragePaid] = await Promise.all([
    allocated(db, "roughPurchaseId", rough.map((r) => r.id), "OUT"),
    allocated(db, "jobWorkBillId", bills.map((b) => b.id), "OUT"),
    allocated(db, "invoiceId", brokered.map((b) => b.id), "OUT"),
  ]);
  const docs: OpenDocument[] = [
    ...rough.map((r): OpenDocument => {
      const totalCents = toCents(r.totalAmount);
      const paidCents = roughPaid.get(r.id) ?? 0;
      return {
        kind: "ROUGH", id: r.id, ref: r.invoiceNo ? `${r.purchaseNo} (${r.invoiceNo})` : r.purchaseNo,
        partyId: r.partyId, partyName: r.party.name, date: r.date, dueDate: r.dueDate, currency: r.currency,
        fxRate: r.fxRate?.toString() ?? null, totalCents, paidCents, outstandingCents: totalCents - paidCents,
      };
    }),
    ...bills.map((b): OpenDocument => {
      const totalCents = toCents(b.amount);
      const paidCents = billPaid.get(b.id) ?? 0;
      return {
        kind: "JOB_WORK", id: b.id, ref: `Bill ${b.billNo}`, partyId: b.partyId, partyName: b.party.name, date: b.date,
        dueDate: null, currency: b.currency, fxRate: b.fxRate?.toString() ?? null, totalCents, paidCents,
        outstandingCents: totalCents - paidCents,
      };
    }),
    ...brokered.map((i): OpenDocument => {
      const totalCents = toCents(i.brokerageAmount!);
      const paidCents = brokeragePaid.get(i.id) ?? 0;
      return {
        kind: "BROKERAGE", id: i.id, ref: `Brokerage on ${i.invoiceNo}`, partyId: i.brokerId!, partyName: i.broker!.name,
        date: i.date, dueDate: null, currency: i.currency, fxRate: i.fxRate?.toString() ?? null, totalCents, paidCents,
        outstandingCents: totalCents - paidCents,
      };
    }),
  ];
  return docs.filter((d) => d.outstandingCents > 0).sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Keeps the polished stones' old "payment status" field in step with the
// receipts on their invoices, so older stock screens stay correct.
export async function syncInvoicePaymentStatus(tx: Tx, invoiceIds: string[]): Promise<void> {
  if (invoiceIds.length === 0) return;
  const [invoices, paid] = await Promise.all([
    tx.invoice.findMany({ where: { id: { in: invoiceIds }, voidedAt: null }, select: { id: true, total: true, lines: { select: { stoneId: true } } } }),
    allocated(tx, "invoiceId", invoiceIds, "IN"),
  ]);
  for (const inv of invoices) {
    const state = payState(toCents(inv.total), paid.get(inv.id) ?? 0);
    await tx.polishedStone.updateMany({
      where: { sourceProductId: { in: inv.lines.map((l) => l.stoneId) } },
      data: { paymentStatus: state },
    });
  }
}
