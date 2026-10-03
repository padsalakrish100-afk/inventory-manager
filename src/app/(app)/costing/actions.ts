"use server";

import { periodLockMessage } from "@/lib/period-lock";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { usdInrOn } from "@/lib/fx";
import { toCents } from "@/lib/money";
import { AllocationError, allocateOverhead, createCostEntries, propagateSplitCosts } from "@/lib/costing/allocate";
import { dateInputToInstant } from "@/lib/dates";
import { parseInput, zCurrency, zDateString, zId, zMoney, zOptionalText } from "@/lib/validation";

const zFx = z.union([
  z.literal("").transform(() => null),
  z.string().trim().regex(/^\d{1,4}(\.\d{1,4})?$/, "Exchange rate must be a number like 88.25."),
]);

const entrySchema = z.object({
  type: z.enum(["CERTIFICATION", "OTHER", "ROUGH"], { message: "Choose the kind of cost." }),
  amount: zMoney("Amount"),
  currency: zCurrency,
  fxRate: zFx,
  date: zDateString(),
  note: zOptionalText(300),
});

// A cost entered by hand on one stone — lab fees, courier, recutting, or a
// rough cost for a stone that came without a purchase.
export async function addCostEntry(stoneId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("costs.view");
  const parsed = parseInput(entrySchema, {
    type: String(formData.get("type") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "INR"),
    fxRate: String(formData.get("fxRate") ?? ""),
    date: String(formData.get("date") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.amount) <= 0) return "Amount must be more than zero.";

  const stone = await prisma.product.findUnique({ where: { id: stoneId }, select: { id: true, status: true } });
  if (!stone) return "Stone not found.";
  if (stone.status === "SPLIT") return "This stone was split — add costs to its children instead.";

  const date = dateInputToInstant(d.date);
  const locked = await periodLockMessage(prisma, [date]);
  if (locked) return locked;
  await prisma.$transaction(async (tx) => {
    const fxRate = d.fxRate ?? (await usdInrOn(tx, date));
    await createCostEntries(tx, viewer.id, [
      {
        stoneId,
        type: d.type,
        date,
        cents: toCents(d.amount),
        currency: d.currency,
        fxRate,
        sourceType: "MANUAL",
        sourceId: null,
        note: d.note,
      },
    ]);
    await writeAudit(tx, viewer.id, {
      action: "CREATE",
      entity: "CostEntry",
      entityId: stoneId,
      after: { stoneId, type: d.type, amount: d.amount, currency: d.currency, fxRate, note: d.note },
    });
  }, TX_OPTIONS);

  revalidatePath(`/stones/${stoneId}`);
}

// Removes a cost entered by hand (or carried over from the old Polish form).
// Costs from purchases, bills, overhead, or splits are corrected at source.
export async function voidCostEntry(entryId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("costs.view");
  const entry = await prisma.costEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.voidedAt) return { error: "Cost entry not found." };
  if (!["MANUAL", "LEGACY_POLISH"].includes(entry.sourceType)) {
    return { error: "This cost comes from a purchase, bill, overhead, or split — change it there." };
  }
  const lockedEntry = await periodLockMessage(prisma, [entry.date]);
  if (lockedEntry) return { error: lockedEntry };
  await prisma.$transaction(async (tx) => {
    const after = await tx.costEntry.update({ where: { id: entryId }, data: { voidedAt: new Date() } });
    await writeAudit(tx, viewer.id, { action: "VOID", entity: "CostEntry", entityId: entryId, before: entry, after });
    await propagateSplitCosts(tx, viewer.id, entry.stoneId);
  }, TX_OPTIONS);
  revalidatePath(`/stones/${entry.stoneId}`);
  return {};
}

const poolSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose the month."),
  amount: zMoney("Amount"),
  currency: zCurrency,
  fxRate: zFx,
  note: zOptionalText(300),
});

// A month's overhead (rent, power, salaries not on piece-rate…), spread over
// the stones worked that month by carats.
export async function createOverheadPool(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("costs.view");
  const parsed = parseInput(poolSchema, {
    month: String(formData.get("month") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "INR"),
    fxRate: String(formData.get("fxRate") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.amount) <= 0) return "Amount must be more than zero.";
  const month = new Date(`${d.month}-01T00:00:00Z`);
  const locked = await periodLockMessage(prisma, [month]);
  if (locked) return locked;

  try {
    await prisma.$transaction(async (tx) => {
      const pool = await tx.overheadPool.create({
        data: {
          month,
          amount: d.amount,
          currency: d.currency,
          fxRate: d.fxRate ?? (await usdInrOn(tx, new Date(`${d.month}-28T12:00:00+05:30`))),
          note: d.note,
          createdById: viewer.id,
        },
      });
      const count = await allocateOverhead(tx, viewer.id, pool.id);
      await writeAudit(tx, viewer.id, { action: "CREATE", entity: "OverheadPool", entityId: pool.id, after: { ...pool, stones: count } });
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof AllocationError) return err.message;
    throw err;
  }
  revalidatePath("/costing/overhead");
}

export async function reallocateOverhead(poolId: string): Promise<{ error?: string; info?: string }> {
  const viewer = await requirePermission("costs.view");
  const parsed = parseInput(zId, poolId);
  if (!parsed.ok) return { error: parsed.error };
  const pool = await prisma.overheadPool.findUnique({ where: { id: poolId }, select: { month: true } });
  const locked = await periodLockMessage(prisma, [pool?.month]);
  if (locked) return { error: locked };
  try {
    const count = await prisma.$transaction(async (tx) => {
      const n = await allocateOverhead(tx, viewer.id, poolId);
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "OverheadPool", entityId: poolId, after: { reallocatedTo: n } });
      return n;
    }, TX_OPTIONS);
    revalidatePath("/costing/overhead");
    return { info: `Spread over ${count} stones.` };
  } catch (err) {
    if (err instanceof AllocationError) return { error: err.message };
    throw err;
  }
}

export async function voidOverheadPool(poolId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  const pool = await prisma.overheadPool.findUnique({ where: { id: poolId }, select: { month: true } });
  const locked = await periodLockMessage(prisma, [pool?.month]);
  if (locked) return { error: locked };
  await prisma.$transaction(async (tx) => {
    const before = await tx.overheadPool.findUniqueOrThrow({ where: { id: poolId } });
    const after = await tx.overheadPool.update({ where: { id: poolId }, data: { voidedAt: new Date() } });
    await allocateOverhead(tx, viewer.id, poolId); // voids its cost entries
    await writeAudit(tx, viewer.id, { action: "VOID", entity: "OverheadPool", entityId: poolId, before, after });
  }, TX_OPTIONS);
  revalidatePath("/costing/overhead");
  return {};
}
