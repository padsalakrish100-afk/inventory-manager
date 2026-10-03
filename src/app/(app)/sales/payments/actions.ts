"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, ForbiddenError, getViewer, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { usdInrOn } from "@/lib/fx";
import { centsToString, inBothCurrencies, toCents } from "@/lib/money";
import { dateInputToInstant, todayIST } from "@/lib/dates";
import { parseInput, zCurrency, zDateString, zId, zMoney, zOptionalFx, zOptionalText } from "@/lib/validation";
import { nextDocumentNo } from "@/lib/sales/numbers";
import { openPayables, openReceivables, syncInvoicePaymentStatus } from "@/lib/sales/balances";

class UserError extends Error {}

const allocationSchema = z.object({
  kind: z.enum(["INVOICE", "ROUGH", "JOB_WORK", "BROKERAGE"]),
  id: zId,
  amount: zMoney("Allocated amount"),
});

const paymentSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  partyId: zId,
  date: zDateString("Date"),
  amount: zMoney("Amount"),
  currency: zCurrency,
  fxRate: zOptionalFx,
  method: zOptionalText(50),
  reference: zOptionalText(100),
  notes: zOptionalText(500),
  allocations: z.array(allocationSchema).max(200),
});

// Receipts (IN) need sales rights; payments out (OUT) settle purchase costs,
// so they need cost visibility too.
async function requireDirection(direction: string) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const ok = direction === "OUT" ? can(viewer, "costs.view") : can(viewer, "sales.manage");
  if (!ok) throw new ForbiddenError();
  return viewer;
}

// Records money in or out and what it settles. Allocations must belong to
// the party, be in the payment's currency, and not exceed what's still
// owed; anything left over stays on account.
export async function createPayment(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const direction = String(formData.get("direction") ?? "");
  const viewer = await requireDirection(direction);

  let allocations: unknown;
  try {
    allocations = JSON.parse(String(formData.get("allocations") ?? "[]"));
  } catch {
    return "Couldn't read the allocations — reload and try again.";
  }
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = parseInput(paymentSchema, {
    direction,
    partyId: str("partyId"),
    date: str("date") || todayIST(),
    amount: str("amount"),
    currency: str("currency") || "USD",
    fxRate: str("fxRate"),
    method: str("method"),
    reference: str("reference"),
    notes: str("notes"),
    allocations,
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  const amountCents = toCents(d.amount);
  if (amountCents <= 0) return "Enter an amount above zero.";
  const allocs = d.allocations.filter((a) => toCents(a.amount) > 0);
  const allocatedCents = allocs.reduce((s, a) => s + toCents(a.amount), 0);
  if (allocatedCents > amountCents) return "More is allocated than the payment amount.";
  if (new Set(allocs.map((a) => `${a.kind}:${a.id}`)).size !== allocs.length) return "A document is listed twice.";
  const date = dateInputToInstant(d.date);

  let paymentId: string;
  try {
    paymentId = await prisma.$transaction(async (tx) => {
      const party = await tx.party.findUnique({ where: { id: d.partyId } });
      if (!party) throw new UserError("Party not found.");
      const fxRate = d.fxRate ?? (await usdInrOn(tx, date));
      if (!fxRate) throw new UserError("Enter the exchange rate (no rate on file for this date).");

      // Check every allocation against what this party still owes / is owed.
      const open = direction === "IN" ? await openReceivables(tx, { partyId: party.id }) : await openPayables(tx, { partyId: party.id });
      const openByKey = new Map(open.map((o) => [`${o.kind}:${o.id}`, o]));
      for (const a of allocs) {
        if (direction === "IN" && a.kind !== "INVOICE") throw new UserError("A receipt can only settle invoices.");
        if (direction === "OUT" && a.kind === "INVOICE") throw new UserError("A payment out can't settle a customer invoice.");
        const doc = openByKey.get(`${a.kind}:${a.id}`);
        if (!doc) throw new UserError("One of the documents is already settled or isn't for this party.");
        if (doc.currency !== d.currency) throw new UserError(`${doc.ref} is in ${doc.currency}; record this payment in ${doc.currency} to settle it.`);
        if (toCents(a.amount) > doc.outstandingCents) throw new UserError(`${doc.ref} has only ${centsToString(doc.outstandingCents)} ${doc.currency} outstanding.`);
      }

      const both = inBothCurrencies(d.amount, d.currency, fxRate);
      const paymentNo = await nextDocumentNo(tx, direction === "IN" ? "RCPT" : "PAY", date);
      const payment = await tx.payment.create({
        data: {
          paymentNo,
          direction,
          partyId: party.id,
          date,
          amount: d.amount,
          currency: d.currency,
          fxRate,
          amountUsd: both.usd,
          amountInr: both.inr,
          method: d.method,
          reference: d.reference,
          notes: d.notes,
          createdById: viewer.id,
          allocations: {
            create: allocs.map((a) => ({
              amount: a.amount,
              invoiceId: a.kind === "INVOICE" || a.kind === "BROKERAGE" ? a.id : null,
              roughPurchaseId: a.kind === "ROUGH" ? a.id : null,
              jobWorkBillId: a.kind === "JOB_WORK" ? a.id : null,
            })),
          },
        },
        include: { allocations: true },
      });
      await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Payment", entityId: payment.id, after: payment });
      if (direction === "IN") await syncInvoicePaymentStatus(tx, allocs.map((a) => a.id));
      return payment.id;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath("/sales", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/polish", "layout");
  redirect(`/sales/payments/${paymentId}`);
}

const voidSchema = z.object({ paymentId: zId, reason: z.string().trim().min(3, "Give a reason.").max(300) });

// Admin only. Cancels a payment and its allocations (documents become
// outstanding again).
export async function voidPayment(paymentId: string, reason: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(voidSchema, { paymentId, reason });
  if (!parsed.ok) return { error: parsed.error };
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
      if (!before || before.voidedAt) throw new UserError("Payment not found.");
      const after = await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: parsed.data.reason } });
      await writeAudit(tx, viewer.id, { action: "VOID", entity: "Payment", entityId: paymentId, before, after });
      if (before.direction === "IN") {
        await syncInvoicePaymentStatus(tx, before.allocations.map((a) => a.invoiceId).filter((x): x is string => Boolean(x)));
      }
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
  revalidatePath("/sales", "layout");
  revalidatePath("/finance", "layout");
  revalidatePath("/polish", "layout");
  return {};
}
