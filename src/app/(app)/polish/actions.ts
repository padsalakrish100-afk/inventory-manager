"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dateInputToInstant } from "@/lib/dates";
import type { PolishStatus, PaymentStatus, SaleType } from "@/generated/prisma/client";
import { POLISH_STATUS_VALUES, PAYMENT_STATUS_VALUES, SALE_TYPE_VALUES, POLISH_STATUS_LABELS } from "@/lib/polish-status";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type AuditEntry } from "@/lib/audit";
import { recordStoneEvents } from "@/lib/stone/events";
import { ensurePartyWithRole } from "@/lib/party";
import { canTransition, stoneStatusFromPolishStatus, STONE_STATUS_LABELS } from "@/lib/stone/status";
import { formToObject, parseInput, zDateString, zOptionalCarat, zOptionalMoney, zOptionalText } from "@/lib/validation";

const gradingSchema = z.object({
  certified: z.string().optional().transform((v) => v === "true"),
  certLab: zOptionalText(50),
  certNumber: zOptionalText(100),
  saleType: z.union([z.literal("").transform(() => null), z.enum(SALE_TYPE_VALUES, { message: "Invalid sale type." })]),
  shape: zOptionalText(100),
  caratWeight: zOptionalCarat("Carat weight"),
  color: zOptionalText(20),
  clarity: zOptionalText(20),
  cutGrade: zOptionalText(30),
  polishGrade: zOptionalText(30),
  symmetry: zOptionalText(30),
  fluorescence: zOptionalText(30),
  measurements: zOptionalText(100),
  notes: zOptionalText(2000),
});

function fieldsFrom(formData: FormData, keys: string[]): Record<string, string> {
  const raw = formToObject(formData);
  return Object.fromEntries(keys.map((k) => [k, typeof raw[k] === "string" ? (raw[k] as string) : ""]));
}

export async function updatePolishedStone(
  polishedStoneId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("stock.edit");

  const parsed = parseInput(gradingSchema, fieldsFrom(formData, Object.keys(gradingSchema.shape)));
  if (!parsed.ok) return parsed.error;
  const { caratWeight, saleType, ...rest } = parsed.data;

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.polishedStone.findUnique({ where: { id: polishedStoneId } });
    if (!before) return false;
    const after = await tx.polishedStone.update({
      where: { id: polishedStoneId },
      data: {
        ...rest,
        saleType: saleType as SaleType | null,
        caratWeight: caratWeight !== null ? Number(caratWeight) : null,
      },
    });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "PolishedStone", entityId: polishedStoneId, before, after });
    return true;
  });
  if (!found) return "Stock entry not found.";

  revalidatePath("/polish");
  revalidatePath(`/polish/${polishedStoneId}`);
}

const saleSchema = z.object({
  status: z.enum(POLISH_STATUS_VALUES, { message: "Invalid status." }),
  location: zOptionalText(100),
  currency: z.enum(["USD", "INR"], { message: "Currency must be USD or INR." }),
  buyer: zOptionalText(200),
  paymentStatus: z.union([
    z.literal("").transform(() => null),
    z.enum(PAYMENT_STATUS_VALUES, { message: "Invalid payment status." }),
  ]),
  askingPrice: zOptionalMoney("Asking price"),
  soldPrice: zOptionalMoney("Sold price"),
  soldDate: zDateString("Sold date"),
});

// Sales tracking for a polished stone — status, where it's kept, its asking
// price, and the buyer/sale details once sold. Costs are in the stone's cost
// ledger, not here (the old cost columns are kept untouched for history).
// The stone's lifecycle status and location follow the sale status.
export async function updateSaleInfo(
  polishedStoneId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("stock.edit");

  const raw = fieldsFrom(formData, Object.keys(saleSchema.shape));
  if (!raw.currency) raw.currency = "USD";
  if (!raw.status) raw.status = "AVAILABLE";
  const parsed = parseInput(saleSchema, raw);
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;

  const money = (v: string | null) => (v !== null ? Number(v) : null);

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.polishedStone.findUnique({
        where: { id: polishedStoneId },
        include: { sourceProduct: true },
      });
      if (!before) throw new UserError("Stock entry not found.");
      const product = before.sourceProduct;

      // Lifecycle: only valid status moves are allowed (an admin can correct
      // a mistake in any direction).
      const nextStoneStatus = stoneStatusFromPolishStatus(d.status);
      if (
        product.status !== nextStoneStatus &&
        !canTransition(product.status, nextStoneStatus) &&
        viewer.role !== "ADMIN"
      ) {
        throw new UserError(
          `A stone can't go from ${STONE_STATUS_LABELS[product.status]} to ${STONE_STATUS_LABELS[nextStoneStatus]} — ask an admin to correct it.`,
        );
      }

      let buyerId: string | null = null;
      if (d.buyer) buyerId = (await ensurePartyWithRole(tx, viewer.id, d.buyer, "CUSTOMER")).id;

      const after = await tx.polishedStone.update({
        where: { id: polishedStoneId },
        data: {
          status: d.status as PolishStatus,
          location: d.location,
          askingPrice: money(d.askingPrice),
          currency: d.currency,
          buyerId,
          soldPrice: money(d.soldPrice),
          soldDate: d.soldDate ? dateInputToInstant(d.soldDate) : null,
          paymentStatus: d.paymentStatus as PaymentStatus | null,
        },
      });

      const nextLocation =
        nextStoneStatus === "SOLD"
          ? "SOLD"
          : nextStoneStatus === "ON_MEMO"
            ? "ON_MEMO"
            : product.stockLocation === "SOLD" || product.stockLocation === "ON_MEMO"
              ? "OFFICE_SAFE"
              : product.stockLocation;
      const productAfter = await tx.product.update({
        where: { id: product.id },
        data: {
          status: nextStoneStatus,
          stockLocation: nextLocation,
          locationPartyId: nextLocation === "SOLD" || nextLocation === "ON_MEMO" ? buyerId : null,
        },
      });

      const { sourceProduct: _sp, ...polishedBefore } = before;
      const audits: AuditEntry[] = [
        { action: "UPDATE", entity: "PolishedStone", entityId: polishedStoneId, before: polishedBefore, after },
        { action: "UPDATE", entity: "Product", entityId: product.id, before: product, after: productAfter },
      ];
      await writeAudit(tx, viewer.id, audits);

      if (before.status !== d.status) {
        await recordStoneEvents(tx, [
          {
            stoneId: product.id,
            type: d.status === "SOLD" ? "SOLD" : "STATUS",
            at: d.status === "SOLD" && d.soldDate ? dateInputToInstant(d.soldDate) : undefined,
            userId: viewer.id,
            partyId: buyerId,
            refType: "PolishedStone",
            refId: polishedStoneId,
            summary:
              d.status === "SOLD"
                ? "Sold"
                : `Status: ${POLISH_STATUS_LABELS[before.status]} → ${POLISH_STATUS_LABELS[d.status]}`,
          },
        ]);
      }
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath("/polish");
  revalidatePath("/polish/summary");
  revalidatePath(`/polish/${polishedStoneId}`);
}

// Undoes a mistaken transfer — deletes the Stock ID and sends the stone
// back to Manufacturing so it can be transferred again correctly. Returns
// the source stone's id so the caller can navigate there itself. Not
// allowed once the stone has been sold.
export async function undoTransfer(polishedStoneId: string): Promise<string> {
  const viewer = await requirePermission("stones.edit");

  const sourceProductId = await prisma.$transaction(async (tx) => {
    const polished = await tx.polishedStone.findUnique({
      where: { id: polishedStoneId },
      include: { sourceProduct: true },
    });
    if (!polished) throw new Error("Stock entry not found.");
    if (polished.status === "SOLD" || polished.soldPrice !== null) {
      throw new Error("This stone has a sale recorded — it can't be sent back to Manufacturing.");
    }

    await tx.polishedStone.delete({ where: { id: polishedStoneId } });
    const productAfter = await tx.product.update({
      where: { id: polished.sourceProductId },
      data: { status: "IN_PRODUCTION", stockLocation: "FACTORY", locationPartyId: null },
    });

    const { sourceProduct, ...polishedBefore } = polished;
    await writeAudit(tx, viewer.id, [
      { action: "DELETE", entity: "PolishedStone", entityId: polished.id, before: polishedBefore },
      { action: "UPDATE", entity: "Product", entityId: sourceProduct.id, before: sourceProduct, after: productAfter },
    ]);
    await recordStoneEvents(tx, [
      {
        stoneId: sourceProduct.id,
        type: "UNDO_TRANSFER",
        userId: viewer.id,
        refType: "PolishedStone",
        refId: polished.id,
        summary: `Transfer undone — Stock ID ${polished.stockId} removed`,
      },
    ]);
    return polished.sourceProductId;
  }, TX_OPTIONS);

  revalidatePath("/polish");
  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/reports");
  revalidatePath(`/stones/${sourceProductId}`);
  return sourceProductId;
}

class UserError extends Error {}
