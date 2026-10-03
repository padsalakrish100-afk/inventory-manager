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
import { createCostEntries } from "@/lib/costing/allocate";
import { toCents } from "@/lib/money";
import { usdInrOn } from "@/lib/fx";
import { saveAttachment, validateUpload } from "@/lib/storage";
import { giaCheckEnabled, giaReportCheck, type GiaReport } from "@/lib/gia";

const zMm = (label: string) =>
  z.union([
    z.literal("").transform(() => null),
    z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, `${label} must be a number with up to 2 decimals.`),
  ]);

const gradingSchema = z.object({
  certified: z.string().optional().transform((v) => v === "true"),
  certLab: zOptionalText(50),
  certNumber: zOptionalText(100),
  certDate: zDateString("Certificate date"),
  cutStyle: zOptionalText(40),
  lengthMm: zMm("Length"),
  widthMm: zMm("Width"),
  depthMm: zMm("Depth"),
  tablePct: zMm("Table %"),
  depthPct: zMm("Depth %"),
  girdle: zOptionalText(60),
  culet: zOptionalText(40),
  crownAngle: zMm("Crown angle"),
  crownHeight: zMm("Crown height"),
  pavilionAngle: zMm("Pavilion angle"),
  pavilionDepth: zMm("Pavilion depth"),
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
  const { caratWeight, saleType, certDate, ...rest } = parsed.data;

  // Antique/specialty attributes: only defined keys, checked by their type.
  // Values for fields not on the form (deactivated, or for another cut
  // style) are kept as they were rather than silently dropped.
  const [definitions, existing] = await Promise.all([
    prisma.attributeDefinition.findMany({ where: { active: true } }),
    prisma.polishedStone.findUnique({ where: { id: polishedStoneId }, select: { attributes: true } }),
  ]);
  const inScope = definitions.filter((d) => !d.cutStyle || d.cutStyle === rest.cutStyle);
  const old = existing?.attributes;
  const attributes: Record<string, string | number | boolean> =
    old && typeof old === "object" && !Array.isArray(old) ? { ...(old as Record<string, string | number | boolean>) } : {};
  for (const def of inScope) delete attributes[def.key];
  for (const def of inScope) {
    const raw = formData.get(`attr_${def.key}`);
    if (def.type === "BOOLEAN") {
      if (raw === "on") attributes[def.key] = true;
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    if (value.length > 200) return `${def.label} is too long.`;
    if (def.type === "NUMBER") {
      if (!/^\d+(\.\d+)?$/.test(value)) return `${def.label} must be a number.`;
      attributes[def.key] = Number(value);
    } else if (def.type === "SELECT") {
      if (!def.options.includes(value)) return `Choose a valid ${def.label.toLowerCase()}.`;
      attributes[def.key] = value;
    } else {
      attributes[def.key] = value;
    }
  }

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.polishedStone.findUnique({ where: { id: polishedStoneId } });
    if (!before) return false;
    const after = await tx.polishedStone.update({
      where: { id: polishedStoneId },
      data: {
        ...rest,
        certLab: rest.certLab ? rest.certLab.toUpperCase() : null,
        certDate: certDate ? dateInputToInstant(certDate) : null,
        attributes,
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
  minPrice: zOptionalMoney("Minimum price"),
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
          minPrice: d.minPrice,
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

// ─── Lab and stock status ───────────────────────────────────────────────────

const labSchema = z.object({
  polishedId: z.string().min(1).max(64),
  lab: zOptionalText(200),
  note: zOptionalText(300),
});

async function changeStoneStatus(
  viewerId: string,
  polishedId: string,
  to: "AT_LAB" | "IN_STOCK",
  opts: { location: "AT_LAB" | "OFFICE_SAFE"; locationPartyId: string | null; summary: string; note: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const polished = await tx.polishedStone.findUnique({ where: { id: polishedId }, include: { sourceProduct: true } });
    if (!polished) throw new UserError("Stock entry not found.");
    const stone = polished.sourceProduct;
    if (!canTransition(stone.status, to)) {
      throw new UserError(`A stone can't go from ${STONE_STATUS_LABELS[stone.status]} to ${STONE_STATUS_LABELS[to]}.`);
    }
    const after = await tx.product.update({
      where: { id: stone.id },
      data: { status: to, stockLocation: opts.location, locationPartyId: opts.locationPartyId },
    });
    await writeAudit(tx, viewerId, { action: "UPDATE", entity: "Product", entityId: stone.id, before: stone, after });
    await recordStoneEvents(tx, [
      {
        stoneId: stone.id,
        type: "STATUS",
        userId: viewerId,
        partyId: opts.locationPartyId,
        refType: "PolishedStone",
        refId: polished.id,
        summary: opts.summary,
        data: opts.note ? { note: opts.note } : undefined,
      },
    ]);
    return { stoneId: stone.id };
  }, TX_OPTIONS);
}

// Polished / in stock → At lab (with which lab, if known).
export async function sendToLab(polishedId: string, lab: string, note: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("stock.edit");
  const parsed = parseInput(labSchema, { polishedId, lab, note });
  if (!parsed.ok) return { error: parsed.error };
  try {
    const labParty = parsed.data.lab
      ? await prisma.$transaction((tx) => ensurePartyWithRole(tx, viewer.id, parsed.data.lab!, "VENDOR"))
      : null;
    const { stoneId } = await changeStoneStatus(viewer.id, polishedId, "AT_LAB", {
      location: "AT_LAB",
      locationPartyId: labParty?.id ?? null,
      summary: `Sent to lab${labParty ? ` — ${labParty.name}` : ""}`,
      note: parsed.data.note,
    });
    revalidatePath(`/polish/${polishedId}`);
    revalidatePath(`/stones/${stoneId}`);
    revalidatePath("/polish");
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

// At lab / polished → In stock (in the office safe). A lab fee entered here
// goes on the stone's cost ledger as certification cost.
export async function markInStock(
  polishedId: string,
  input: { note: string; fee: string; currency: string },
): Promise<{ error?: string }> {
  const viewer = await requirePermission("stock.edit");
  const parsed = parseInput(
    z.object({ note: zOptionalText(300), fee: zOptionalMoney("Lab fee"), currency: z.enum(["USD", "INR"]) }),
    input,
  );
  if (!parsed.ok) return { error: parsed.error };
  try {
    const { stoneId } = await changeStoneStatus(viewer.id, polishedId, "IN_STOCK", {
      location: "OFFICE_SAFE",
      locationPartyId: null,
      summary: "In stock",
      note: parsed.data.note,
    });
    if (parsed.data.fee && Number(parsed.data.fee) > 0) {
      await prisma.$transaction(async (tx) => {
        const date = new Date();
        await createCostEntries(tx, viewer.id, [
          {
            stoneId,
            type: "CERTIFICATION",
            date,
            cents: toCents(parsed.data.fee!),
            currency: parsed.data.currency,
            fxRate: await usdInrOn(tx, date),
            sourceType: "MANUAL",
            sourceId: null,
            note: "Lab fee",
          },
        ]);
        await writeAudit(tx, viewer.id, {
          action: "CREATE",
          entity: "CostEntry",
          entityId: stoneId,
          after: { type: "CERTIFICATION", amount: parsed.data.fee, currency: parsed.data.currency, note: "Lab fee" },
        });
      });
    }
    revalidatePath(`/polish/${polishedId}`);
    revalidatePath(`/stones/${stoneId}`);
    revalidatePath("/polish");
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

// Attaches the lab certificate PDF (or a photo of it).
export async function uploadCertificate(polishedId: string, formData: FormData): Promise<{ error?: string }> {
  const viewer = await requirePermission("stock.edit");
  const file = formData.get("certificate");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the certificate file." };
  const problem = validateUpload(file, "image-or-pdf");
  if (problem) return { error: problem };
  if (!(await prisma.polishedStone.findUnique({ where: { id: polishedId }, select: { id: true } }))) {
    return { error: "Stock entry not found." };
  }
  await prisma.$transaction(async (tx) => {
    const a = await saveAttachment(tx, { entityType: "POLISH_CERT", entityId: polishedId, kind: "CERTIFICATE", file, uploadedById: viewer.id });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Attachment", entityId: a.id, after: a });
  });
  revalidatePath(`/polish/${polishedId}`);
  return {};
}

// Optional GIA Report Check (only when GIA_REPORT_API_KEY is set). Shows
// what GIA has on file next to what we recorded; it doesn't overwrite.
export async function checkWithGia(polishedId: string): Promise<{ error?: string; report?: GiaReport | null }> {
  await requirePermission("stock.view");
  if (!giaCheckEnabled()) return { error: "GIA Report Check isn't configured." };
  const polished = await prisma.polishedStone.findUnique({ where: { id: polishedId }, select: { certLab: true, certNumber: true } });
  if (!polished?.certNumber || polished.certLab?.toUpperCase() !== "GIA") return { error: "Enter the GIA report number first." };
  try {
    return { report: await giaReportCheck(polished.certNumber) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "GIA check failed." };
  }
}

class UserError extends Error {}
