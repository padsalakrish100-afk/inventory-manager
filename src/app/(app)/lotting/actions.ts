"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, ForbiddenError, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type Tx } from "@/lib/audit";
import { recordStoneEvents } from "@/lib/stone/events";
import { ensurePartyWithRole } from "@/lib/party";
import { parseInput, zOptionalCarat, zOptionalMoney, zRequiredText } from "@/lib/validation";

async function nextLotNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LOT-${year}-`;
  const existing = await tx.lot.findMany({
    where: { lotNumber: { startsWith: prefix } },
    select: { lotNumber: true },
  });
  const usedIndexes = existing
    .map((l) => Number(l.lotNumber.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
  const next = usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

const createLotSchema = z.object({
  sourceParty: zRequiredText("Source (tender or party)"),
  roughWeight: zOptionalCarat("Rough weight"),
  purchaseCost: zOptionalMoney("Purchase cost"),
  stoneCount: z.coerce
    .number({ message: "Number of stones must be between 1 and 5000." })
    .int("Number of stones must be between 1 and 5000.")
    .min(1, "Number of stones must be between 1 and 5000.")
    .max(5000, "Number of stones must be between 1 and 5000."),
});

// Creates a lot and immediately generates its numbered stones — the only
// inputs are where the rough came from, how heavy it is, and how many
// stones are in it. No certification, stage, or naming choices to make.
export async function createLot(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("lots.manage");

  const parsed = parseInput(createLotSchema, {
    sourceParty: String(formData.get("sourceParty") ?? ""),
    roughWeight: String(formData.get("roughWeight") ?? ""),
    purchaseCost: String(formData.get("purchaseCost") ?? ""),
    stoneCount: String(formData.get("stoneCount") ?? ""),
  });
  if (!parsed.ok) return parsed.error;
  const { sourceParty: sourcePartyName, roughWeight, stoneCount } = parsed.data;
  if (roughWeight !== null && Number(roughWeight) <= 0) return "Rough weight must be a positive number.";
  // Rough price is hidden from people who can't see costs, so it can't be
  // entered by them either.
  const purchaseCost = can(viewer, "costs.view") ? parsed.data.purchaseCost : null;

  const lotId = await prisma.$transaction(async (tx) => {
    const sourceParty = await ensurePartyWithRole(tx, viewer.id, sourcePartyName, "VENDOR");
    const lotNumber = await nextLotNumber(tx);

    const lot = await tx.lot.create({
      data: {
        lotNumber,
        roughWeight: roughWeight !== null ? Number(roughWeight) : null,
        purchaseCost: purchaseCost !== null ? Number(purchaseCost) : null,
        sourcePartyId: sourceParty.id,
      },
    });

    const skus = Array.from({ length: stoneCount }, (_, i) => `${lotNumber}-${String(i + 1).padStart(4, "0")}`);
    await tx.product.createMany({
      data: skus.map((sku) => ({ sku, name: sku, unit: "pcs", stock: 1, lotId: lot.id })),
    });
    const created = await tx.product.findMany({ where: { lotId: lot.id }, select: { id: true } });

    await recordStoneEvents(
      tx,
      created.map((p) => ({
        stoneId: p.id,
        type: "CREATED" as const,
        userId: viewer.id,
        refType: "Lot",
        refId: lot.id,
        summary: `Created in lot ${lotNumber}`,
      })),
    );
    await writeAudit(tx, viewer.id, [
      { action: "CREATE", entity: "Lot", entityId: lot.id, after: lot },
      {
        action: "BULK_CREATE",
        entity: "Product",
        entityId: lot.id,
        after: { lotId: lot.id, count: skus.length, first: skus[0], last: skus[skus.length - 1] },
      },
    ]);
    return lot.id;
  }, TX_OPTIONS);

  revalidatePath("/lotting");
  revalidatePath("/stones");
  redirect(`/lotting/${lotId}`);
}

// Deletes a lot entered by mistake — only allowed while none of its stones
// have ever been issued or transferred to Polish, so real manufacturing
// history can never be silently erased.
export async function deleteLot(lotId: string) {
  const viewer = await requirePermission("lots.manage");

  await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({
      where: { id: lotId },
      include: {
        products: {
          include: {
            polishedStone: true,
            _count: { select: { movements: true, transactions: true, processLogs: true, children: true } },
          },
        },
      },
    });
    if (!lot) throw new Error("Lot not found.");

    const hasHistory = lot.products.some((p) => p.polishedStone || p._count.movements > 0 || p._count.children > 0);
    if (hasHistory) {
      throw new Error("This lot has stones with manufacturing history — can't delete it.");
    }

    const hasLegacyRecords = lot.products.some((p) => p._count.transactions > 0 || p._count.processLogs > 0);
    if (hasLegacyRecords) {
      throw new Error(
        "This lot has stones with recorded transaction history from before this app was rebuilt — can't delete it.",
      );
    }

    await tx.product.deleteMany({ where: { lotId } });
    await tx.lot.delete({ where: { id: lotId } });

    const { products, ...lotBefore } = lot;
    await writeAudit(tx, viewer.id, {
      action: "DELETE",
      entity: "Lot",
      entityId: lotId,
      before: { ...lotBefore, stones: products.map((p) => ({ id: p.id, sku: p.sku, caratWeight: p.caratWeight })) },
    });
  }, TX_OPTIONS);

  revalidatePath("/lotting");
  revalidatePath("/stones");
  revalidatePath("/manufacturing/reports");
}

// Saves one stone's weight from the inline field on the lot detail page —
// used right after lotting to record actual per-stone weights as they're
// known, without having to wait until the stone moves through manufacturing.
// While the stone has never been issued, this is also its rough weight.
export async function updateStoneWeight(productId: string, weightRaw: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("lots.manage");

  const parsed = parseInput(zOptionalCarat("Weight"), weightRaw);
  if (!parsed.ok) return { error: parsed.error };
  const weight = parsed.data;

  const lotId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { movements: true } } },
    });
    if (!product) return null;

    const neverIssued = product._count.movements === 0;
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        caratWeight: weight !== null ? Number(weight) : null,
        ...(neverIssued ? { roughWeight: weight } : {}),
      },
    });

    const { _count, ...before } = product;
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Product", entityId: productId, before, after: updated });
    await recordStoneEvents(tx, [
      {
        stoneId: productId,
        type: "WEIGHT",
        userId: viewer.id,
        weightBefore: product.caratWeight,
        weightAfter: weight,
        summary: neverIssued ? "Rough weight recorded" : "Weight corrected",
      },
    ]);
    return product.lotId ?? "";
  }, TX_OPTIONS);

  if (lotId === null) return { error: "Stone not found." };
  if (lotId) revalidatePath(`/lotting/${lotId}`);
  revalidatePath(`/stones/${productId}`);
  return {};
}

// Saves the total purchase cost for a lot — feeds the rough-cost allocation
// suggested on each of its stones' Polish sale forms (split proportionally
// by rough weight), editable any time as the real figure becomes known.
export async function updateLotPurchaseCost(lotId: string, costRaw: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("lots.manage");
  if (!can(viewer, "costs.view")) throw new ForbiddenError();

  const parsed = parseInput(zOptionalMoney("Purchase cost"), costRaw);
  if (!parsed.ok) return { error: parsed.error };
  const cost = parsed.data;

  const found = await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (!lot) return false;
    const updated = await tx.lot.update({
      where: { id: lotId },
      data: { purchaseCost: cost !== null ? Number(cost) : null },
    });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Lot", entityId: lotId, before: lot, after: updated });
    return true;
  });
  if (!found) return { error: "Lot not found." };

  revalidatePath(`/lotting/${lotId}`);
  revalidatePath("/lotting");
  return {};
}
