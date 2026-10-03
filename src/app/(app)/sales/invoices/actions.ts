"use server";

import { assertPeriodsOpen, UserFacingError } from "@/lib/period-lock";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type AuditEntry } from "@/lib/audit";
import { recordStoneEvents, type StoneEventInput } from "@/lib/stone/events";
import { ensurePartyWithRole } from "@/lib/party";
import { usdInrOn } from "@/lib/fx";
import { centsToString, inBothCurrencies, toCents } from "@/lib/money";
import { dateInputToInstant, todayIST } from "@/lib/dates";
import {
  parseInput,
  zCurrency,
  zDateString,
  zId,
  zOptionalFx,
  zOptionalMoney,
  zOptionalText,
  zRequiredText,
} from "@/lib/validation";
import { nextDocumentNo } from "@/lib/sales/numbers";
import { parseDocLines } from "@/lib/sales/lines";
import { caratsOf, describeStone, refreshMemoStatus } from "@/lib/sales/stones";
import { stoneCosts } from "@/lib/costing/ledger";
import { canTransition, STONE_STATUS_LABELS } from "@/lib/stone/status";

class UserError extends UserFacingError {}

const zPct = z.union([
  z.literal("").transform(() => null),
  z.string().trim().regex(/^\d{1,2}(\.\d{1,3})?$/, "Brokerage % must be a number below 100."),
]);

const shippingFields = {
  shipToName: zOptionalText(200),
  shipToAddress: zOptionalText(1000),
  shipToCountry: zOptionalText(100),
  incoterm: zOptionalText(10),
  hsCode: zOptionalText(20),
  portOfLoading: zOptionalText(100),
  portOfDischarge: zOptionalText(100),
  awbNo: zOptionalText(100),
  carrier: zOptionalText(100),
  kpCertNo: zOptionalText(100),
  notes: zOptionalText(2000),
};

const invoiceSchema = z.object({
  party: zRequiredText("Customer", 200),
  date: zDateString("Invoice date"),
  dueDate: zDateString("Due date"),
  currency: zCurrency,
  fxRate: zOptionalFx,
  broker: zOptionalText(200),
  brokeragePct: zPct,
  shipping: zOptionalMoney("Shipping"),
  insurance: zOptionalMoney("Insurance"),
  ...shippingFields,
});

function read(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

// Sells stones on an invoice. A stone must be in stock, or out on memo with
// this same customer (the memo line is then marked sold). The stone is sold
// to the customer, its cost is frozen on the line for profit, and the old
// sale fields on the polished stone are kept in step for older screens.
export async function createInvoice(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("sales.manage");
  const raw = read(formData, Object.keys(invoiceSchema.shape));
  if (!raw.date) raw.date = todayIST();
  if (!raw.currency) raw.currency = "USD";
  const parsed = parseInput(invoiceSchema, raw);
  if (!parsed.ok) return parsed.error;
  const lines = parseDocLines(formData.get("lines"));
  if (!lines.ok) return lines.error;
  const d = parsed.data;
  if (d.brokeragePct && !d.broker) return "Enter the broker for the brokerage.";
  const date = dateInputToInstant(d.date);
  const dueDate = d.dueDate ? dateInputToInstant(d.dueDate) : null;
  if (dueDate && dueDate < date) return "The due date can't be before the invoice date.";

  let invoiceId: string;
  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      await assertPeriodsOpen(tx, [date]);
      const fxRate = d.fxRate ?? (await usdInrOn(tx, date));
      if (!fxRate) throw new UserError("Enter the exchange rate (no rate on file for this date).");
      const party = await ensurePartyWithRole(tx, viewer.id, d.party, "CUSTOMER");
      const broker = d.broker ? await ensurePartyWithRole(tx, viewer.id, d.broker, "BROKER") : null;
      if (broker && broker.id === party.id) throw new UserError("The broker can't be the customer.");

      const stones = await tx.product.findMany({
        where: { id: { in: lines.lines.map((l) => l.stoneId) } },
        include: {
          polishedStone: true,
          salesMemoLines: { where: { status: "OUT" }, include: { memo: { select: { id: true, memoNo: true, partyId: true, voidedAt: true, party: { select: { name: true } } } } } },
        },
      });
      const byId = new Map(stones.map((s) => [s.id, s]));
      for (const l of lines.lines) {
        const s = byId.get(l.stoneId);
        if (!s?.polishedStone) throw new UserError("One of the stones isn't in polished stock.");
        const memoLine = s.salesMemoLines.find((m) => !m.memo.voidedAt);
        if (s.status === "ON_MEMO") {
          if (!memoLine) throw new UserError(`${s.polishedStone.stockId} is on memo but its memo can't be found.`);
          if (memoLine.memo.partyId !== party.id) {
            throw new UserError(`${s.polishedStone.stockId} is on memo ${memoLine.memo.memoNo} with ${memoLine.memo.party.name} — return it first.`);
          }
        } else if (!canTransition(s.status, "SOLD") || s.status === "SOLD") {
          throw new UserError(`${s.polishedStone.stockId} is ${STONE_STATUS_LABELS[s.status].toLowerCase()} and can't be sold.`);
        }
      }

      const costs = await stoneCosts(tx, stones.map((s) => s.id));
      const lineData = lines.lines.map((l) => {
        const s = byId.get(l.stoneId)!;
        const carats = caratsOf(s.polishedStone!, s);
        const cents = toCents(l.amount);
        const cost = costs.get(s.id);
        return {
          stone: s,
          cents,
          memoLine: s.status === "ON_MEMO" ? s.salesMemoLines.find((m) => !m.memo.voidedAt)! : null,
          data: {
            stoneId: s.id,
            description: describeStone(s.polishedStone!),
            carats,
            amount: centsToString(cents),
            pricePerCt: Number(carats) > 0 ? centsToString(Math.round(cents / Number(carats))) : centsToString(cents),
            costUsd: cost && cost.lines.length > 0 ? centsToString(cost.usdCents) : null,
          },
        };
      });

      const subtotalCents = lineData.reduce((a, l) => a + l.cents, 0);
      const totalCents = subtotalCents + (d.shipping ? toCents(d.shipping) : 0) + (d.insurance ? toCents(d.insurance) : 0);
      const brokerageCents = d.brokeragePct ? Math.round((subtotalCents * Number(d.brokeragePct)) / 100) : null;
      const both = inBothCurrencies(centsToString(totalCents), d.currency, fxRate);
      const invoiceNo = await nextDocumentNo(tx, "INV", date);

      const { party: _p, date: _d, dueDate: _dd, fxRate: _f, broker: _b, brokeragePct, shipping, insurance, hsCode, ...rest } = d;
      const invoice = await tx.invoice.create({
        data: {
          ...rest,
          hsCode: hsCode ?? "7102.39",
          invoiceNo,
          partyId: party.id,
          date,
          dueDate,
          fxRate,
          brokerId: broker?.id ?? null,
          brokeragePct,
          brokerageAmount: brokerageCents !== null ? centsToString(brokerageCents) : null,
          shipping,
          insurance,
          subtotal: centsToString(subtotalCents),
          total: centsToString(totalCents),
          totalUsd: both.usd,
          totalInr: both.inr,
          createdById: viewer.id,
          lines: { create: lineData.map((l) => l.data) },
        },
        include: { lines: true },
      });

      const audits: AuditEntry[] = [{ action: "CREATE", entity: "Invoice", entityId: invoice.id, after: invoice }];
      const events: StoneEventInput[] = [];
      const memoIds: string[] = [];
      for (const l of lineData) {
        const s = l.stone;
        const invLine = invoice.lines.find((x) => x.stoneId === s.id)!;
        if (l.memoLine) {
          await tx.salesMemoLine.update({ where: { id: l.memoLine.id }, data: { status: "SOLD", invoiceLineId: invLine.id } });
          memoIds.push(l.memoLine.memoId);
        }
        const after = await tx.product.update({
          where: { id: s.id },
          data: { status: "SOLD", stockLocation: "SOLD", locationPartyId: party.id },
        });
        await tx.polishedStone.update({
          where: { id: s.polishedStone!.id },
          data: {
            status: "SOLD",
            buyerId: party.id,
            soldPrice: l.cents / 100,
            soldDate: date,
            currency: d.currency,
            paymentStatus: "UNPAID",
          },
        });
        const { polishedStone: _ps, salesMemoLines: _sm, ...before } = s;
        audits.push({ action: "UPDATE", entity: "Product", entityId: s.id, before, after });
        events.push({
          stoneId: s.id, type: "SOLD", at: date, userId: viewer.id, partyId: party.id,
          refType: "Invoice", refId: invoice.id, summary: `Sold on ${invoiceNo} — ${party.name}`,
        });
      }
      await refreshMemoStatus(tx, memoIds);
      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
      return invoice.id;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserFacingError) return err.message;
    throw err;
  }

  revalidatePath("/sales", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/polish", "layout");
  redirect(`/sales/invoices/${invoiceId}`);
}

const detailsSchema = z.object({ dueDate: zDateString("Due date"), ...shippingFields });

// Shipping/export details, due date and notes can be filled in later (the
// AWB number usually comes after the invoice). Prices and stones can't be
// changed — void and reissue instead.
export async function updateInvoiceDetails(
  invoiceId: string,
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("sales.manage");
  const parsed = parseInput(detailsSchema, read(formData, Object.keys(detailsSchema.shape)));
  if (!parsed.ok) return parsed.error;
  const { dueDate, ...rest } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!before || before.voidedAt) throw new UserError("Invoice not found.");
      const due = dueDate ? dateInputToInstant(dueDate) : null;
      if (due && due < before.date) throw new UserError("The due date can't be before the invoice date.");
      const after = await tx.invoice.update({ where: { id: invoiceId }, data: { ...rest, dueDate: due } });
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Invoice", entityId: invoiceId, before, after });
    });
  } catch (err) {
    if (err instanceof UserFacingError) return err.message;
    throw err;
  }
  revalidatePath(`/sales/invoices/${invoiceId}`);
  return "Saved.";
}

const voidSchema = z.object({ invoiceId: zId, reason: z.string().trim().min(3, "Give a reason.").max(300) });

// Admin only. Cancels an invoice that has no receipts against it: the
// stones go back on memo (if they came from one) or into stock.
export async function voidInvoice(invoiceId: string, reason: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(voidSchema, { invoiceId, reason });
  if (!parsed.ok) return { error: parsed.error };

  try {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { include: { memoLine: { include: { memo: true } }, stone: { include: { polishedStone: true } } } },
          allocations: { where: { payment: { voidedAt: null } }, select: { id: true } },
        },
      });
      if (!inv || inv.voidedAt) throw new UserError("Invoice not found.");
      if (inv.allocations.length > 0) throw new UserError("Payments are recorded against this invoice — void those first.");
      await assertPeriodsOpen(tx, [inv.date]);

      const after = await tx.invoice.update({ where: { id: inv.id }, data: { voidedAt: new Date(), voidReason: parsed.data.reason } });
      const { lines: _l, allocations: _a, ...before } = inv;
      const audits: AuditEntry[] = [{ action: "VOID", entity: "Invoice", entityId: inv.id, before, after }];
      const events: StoneEventInput[] = [];
      const memoIds: string[] = [];
      for (const line of inv.lines) {
        const s = line.stone;
        const memo = line.memoLine && !line.memoLine.memo.voidedAt ? line.memoLine.memo : null;
        if (line.memoLine) {
          await tx.salesMemoLine.update({ where: { id: line.memoLine.id }, data: { status: "OUT", invoiceLineId: null } });
          memoIds.push(line.memoLine.memoId);
        }
        const stoneAfter = await tx.product.update({
          where: { id: s.id },
          data: memo
            ? { status: "ON_MEMO", stockLocation: "ON_MEMO", locationPartyId: memo.partyId }
            : { status: "IN_STOCK", stockLocation: "OFFICE_SAFE", locationPartyId: null },
        });
        if (s.polishedStone) {
          await tx.polishedStone.update({
            where: { id: s.polishedStone.id },
            data: { status: memo ? "ON_MEMO" : "AVAILABLE", buyerId: null, soldPrice: null, soldDate: null, paymentStatus: null },
          });
        }
        const { polishedStone: _ps, ...stoneBefore } = s;
        audits.push({ action: "UPDATE", entity: "Product", entityId: s.id, before: stoneBefore, after: stoneAfter });
        events.push({
          stoneId: s.id, type: "SALE_VOID", userId: viewer.id, refType: "Invoice", refId: inv.id,
          summary: `Invoice ${inv.invoiceNo} voided — ${memo ? `back on memo ${memo.memoNo}` : "back in stock"}`,
          data: { reason: parsed.data.reason },
        });
      }
      await refreshMemoStatus(tx, memoIds);
      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
  revalidatePath("/sales", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/polish", "layout");
  return {};
}
