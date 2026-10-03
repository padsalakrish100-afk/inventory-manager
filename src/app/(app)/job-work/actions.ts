"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, ForbiddenError, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { usdInrOn } from "@/lib/fx";
import { dateInputToInstant } from "@/lib/dates";
import { formToObject, parseInput, zCurrency, zDateString, zId, zMoney, zOptionalText, zRequiredText } from "@/lib/validation";

const billSchema = z.object({
  partyId: zId,
  billNo: zRequiredText("Bill number", 60),
  date: zDateString(),
  amount: zMoney("Amount"),
  currency: zCurrency,
  notes: zOptionalText(1000),
  movementIds: z.array(zId).max(1000),
});

// Records an outside factory's bill and links the returned jobs it covers.
// The bill (not a rate card) is what that work cost.
export async function createJobWorkBill(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("karigars.manage");
  if (!can(viewer, "costs.view")) throw new ForbiddenError();

  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(billSchema, {
    partyId: str("partyId"),
    billNo: str("billNo"),
    date: str("date"),
    amount: str("amount"),
    currency: str("currency") || "INR",
    notes: str("notes"),
    movementIds: Array.isArray(raw["movementIds[]"]) ? raw["movementIds[]"] : [],
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.amount) <= 0) return "Amount must be more than zero.";

  const party = await prisma.party.findUnique({ where: { id: d.partyId } });
  if (!party || !party.roles.includes("JOB_WORKER")) return "Choose a job-worker.";
  if (await prisma.jobWorkBill.findUnique({ where: { partyId_billNo: { partyId: d.partyId, billNo: d.billNo } } })) {
    return "This job-worker already has a bill with that number.";
  }

  const date = dateInputToInstant(d.date);
  try {
    await prisma.$transaction(async (tx) => {
      const movements = await tx.processMovement.findMany({
        where: { id: { in: d.movementIds } },
        select: { id: true, partyId: true, returnDate: true, voidedAt: true, jobWorkBillId: true },
      });
      for (const m of movements) {
        if (m.partyId !== d.partyId || !m.returnDate || m.voidedAt || m.jobWorkBillId) {
          throw new UserError("One of the selected jobs can't be billed (not returned, not theirs, or already billed).");
        }
      }
      const bill = await tx.jobWorkBill.create({
        data: {
          partyId: d.partyId,
          billNo: d.billNo,
          date,
          amount: d.amount,
          currency: d.currency,
          fxRate: await usdInrOn(tx, date),
          notes: d.notes,
          createdById: viewer.id,
        },
      });
      if (movements.length) {
        await tx.processMovement.updateMany({ where: { id: { in: movements.map((m) => m.id) } }, data: { jobWorkBillId: bill.id } });
      }
      await writeAudit(tx, viewer.id, {
        action: "CREATE",
        entity: "JobWorkBill",
        entityId: bill.id,
        after: { ...bill, movementIds: movements.map((m) => m.id) },
      });
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath("/job-work");
  redirect("/job-work");
}

// Admin: cancels a bill entered by mistake; its jobs become unbilled again.
export async function voidJobWorkBill(billId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.jobWorkBill.findUnique({ where: { id: billId } });
      if (!before || before.voidedAt) throw new UserError("Bill not found.");
      await tx.processMovement.updateMany({ where: { jobWorkBillId: billId }, data: { jobWorkBillId: null } });
      const after = await tx.jobWorkBill.update({ where: { id: billId }, data: { voidedAt: new Date() } });
      await writeAudit(tx, viewer.id, { action: "VOID", entity: "JobWorkBill", entityId: billId, before, after });
    });
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
  revalidatePath("/job-work");
  return {};
}

class UserError extends Error {}
