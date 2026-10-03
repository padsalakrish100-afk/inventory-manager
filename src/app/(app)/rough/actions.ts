"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, ForbiddenError, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { nextCounter } from "@/lib/counter";
import { ensurePartyWithRole } from "@/lib/party";
import { saveAttachment, validateUpload } from "@/lib/storage";
import { usdInrOn } from "@/lib/fx";
import { createLotWithStones } from "@/lib/lot";
import { allocateCents, centsToString, toCents } from "@/lib/money";
import { AllocationError, allocateLotRough } from "@/lib/costing/allocate";
import { dateInputToInstant, dateInputToStartOfDayIST } from "@/lib/dates";
import {
  formToObject,
  parseInput,
  zCarat,
  zCurrency,
  zDateString,
  zId,
  zOptionalMoney,
  zOptionalText,
  zRequiredText,
} from "@/lib/validation";

const zFx = z.union([
  z.literal("").transform(() => null),
  z.string().trim().regex(/^\d{1,4}(\.\d{1,4})?$/, "Exchange rate must be a number like 88.25."),
]);

const purchaseSchema = z.object({
  party: zRequiredText("Supplier"),
  date: zDateString(),
  source: zOptionalText(200),
  totalCarats: zCarat("Total carats"),
  pieces: z.coerce.number({ message: "Pieces must be a whole number." }).int().min(1, "Pieces must be at least 1.").max(1_000_000),
  pricePerCarat: zOptionalMoney("Price per carat"),
  totalAmount: zOptionalMoney("Total amount"),
  currency: zCurrency,
  fxRate: zFx,
  invoiceNo: zOptionalText(100),
  kpCertNo: zOptionalText(100),
  dueDate: zDateString("Due date"),
  notes: zOptionalText(2000),
});

function files(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
}

// Records a rough purchase with its invoice and Kimberley Process
// certificate. Price is shown in purchase currency and stored with the
// exchange rate of the purchase date.
export async function createRoughPurchase(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("lots.manage");
  if (!can(viewer, "costs.view")) throw new ForbiddenError("Rough price is restricted — ask someone who can see costs.");

  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(purchaseSchema, Object.fromEntries(Object.keys(purchaseSchema.shape).map((k) => [k, str(k)])));
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.totalCarats) <= 0) return "Total carats must be more than zero.";

  // Either total or price/ct; the other is worked out (total wins if both).
  const caratsMilli = Math.round(Number(d.totalCarats) * 1000);
  let totalCents: number;
  let ppcCents: number;
  if (d.totalAmount !== null) {
    totalCents = toCents(d.totalAmount);
    ppcCents = Math.round((totalCents * 1000) / caratsMilli);
  } else if (d.pricePerCarat !== null) {
    ppcCents = toCents(d.pricePerCarat);
    totalCents = Math.round((ppcCents * caratsMilli) / 1000);
  } else {
    return "Enter the total amount or the price per carat.";
  }
  if (totalCents <= 0) return "The amount must be more than zero.";

  const invoices = files(formData, "invoiceFiles");
  const kpFiles = files(formData, "kpFiles");
  if (invoices.length + kpFiles.length > 6) return "Attach at most 6 files.";
  for (const f of [...invoices, ...kpFiles]) {
    const problem = validateUpload(f, "image-or-pdf");
    if (problem) return problem;
  }

  const date = dateInputToInstant(d.date);
  const id = await prisma.$transaction(async (tx) => {
    const party = await ensurePartyWithRole(tx, viewer.id, d.party, "VENDOR");
    const year = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date);
    const n = await nextCounter(tx, `RP-${year}`);
    const purchase = await tx.roughPurchase.create({
      data: {
        purchaseNo: `RP-${year}-${String(n).padStart(3, "0")}`,
        partyId: party.id,
        date,
        source: d.source,
        totalCarats: d.totalCarats,
        pieces: d.pieces,
        pricePerCarat: centsToString(ppcCents),
        totalAmount: centsToString(totalCents),
        currency: d.currency,
        fxRate: d.fxRate ?? (await usdInrOn(tx, date)),
        invoiceNo: d.invoiceNo,
        kpCertNo: d.kpCertNo,
        dueDate: d.dueDate ? dateInputToStartOfDayIST(d.dueDate) : null,
        notes: d.notes,
        createdById: viewer.id,
      },
    });
    for (const f of invoices) {
      await saveAttachment(tx, { entityType: "ROUGH_INVOICE", entityId: purchase.id, kind: "INVOICE", file: f, uploadedById: viewer.id });
    }
    for (const f of kpFiles) {
      await saveAttachment(tx, { entityType: "ROUGH_KP", entityId: purchase.id, kind: "KP_CERT", file: f, uploadedById: viewer.id });
    }
    await writeAudit(tx, viewer.id, {
      action: "CREATE",
      entity: "RoughPurchase",
      entityId: purchase.id,
      after: { ...purchase, files: invoices.length + kpFiles.length },
    });
    return purchase.id;
  }, TX_OPTIONS);

  revalidatePath("/rough");
  redirect(`/rough/${id}`);
}

// Adds the KP certificate (number and/or file) later — compliance needs it
// before the rough goes into production.
export async function updateKp(purchaseId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("lots.manage");
  const parsed = parseInput(zOptionalText(100), String(formData.get("kpCertNo") ?? ""));
  if (!parsed.ok) return parsed.error;
  const kpFiles = files(formData, "kpFiles");
  for (const f of kpFiles) {
    const problem = validateUpload(f, "image-or-pdf");
    if (problem) return problem;
  }
  await prisma.$transaction(async (tx) => {
    const before = await tx.roughPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    const after = await tx.roughPurchase.update({ where: { id: purchaseId }, data: { kpCertNo: parsed.data } });
    for (const f of kpFiles) {
      await saveAttachment(tx, { entityType: "ROUGH_KP", entityId: purchaseId, kind: "KP_CERT", file: f, uploadedById: viewer.id });
    }
    await writeAudit(tx, viewer.id, {
      action: "UPDATE",
      entity: "RoughPurchase",
      entityId: purchaseId,
      before,
      after: { ...after, ...(kpFiles.length ? { kpFilesAdded: kpFiles.length } : {}) },
    });
  }, TX_OPTIONS);
  revalidatePath(`/rough/${purchaseId}`);
  return "Saved.";
}

const packetSchema = z.object({
  sizeRange: zOptionalText(60),
  quality: zOptionalText(60),
  model: zOptionalText(60),
  carats: zCarat("Packet carats"),
  pieces: z.coerce.number({ message: "Pieces must be a whole number." }).int().min(1, "Pieces must be at least 1.").max(100_000),
  notes: zOptionalText(500),
});

function letter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// One packet from assorting the purchase (size, quality, model). Its code is
// the purchase number + A, B, C…
export async function addPacket(purchaseId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("lots.manage");
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(packetSchema, Object.fromEntries(Object.keys(packetSchema.shape).map((k) => [k, str(k)])));
  if (!parsed.ok) return parsed.error;
  if (Number(parsed.data.carats) <= 0) return "Packet carats must be more than zero.";

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.roughPurchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { packets: { select: { packetCode: true } } } });
    if (purchase.voidedAt) throw new Error("This purchase was cancelled.");
    const used = new Set(purchase.packets.map((p) => p.packetCode));
    let i = 0;
    while (used.has(`${purchase.purchaseNo}-${letter(i)}`)) i++;
    const packet = await tx.roughPacket.create({
      data: { purchaseId, packetCode: `${purchase.purchaseNo}-${letter(i)}`, ...parsed.data },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "RoughPacket", entityId: packet.id, after: packet });
  });
  revalidatePath(`/rough/${purchaseId}`);
}

export async function deletePacket(packetId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("lots.manage");
  const packet = await prisma.roughPacket.findUnique({ where: { id: packetId }, include: { lot: { select: { id: true } } } });
  if (!packet) return { error: "Packet not found." };
  if (packet.lot) return { error: "This packet is already in production as a lot." };
  await prisma.$transaction(async (tx) => {
    await tx.roughPacket.delete({ where: { id: packetId } });
    const { lot: _l, ...before } = packet;
    await writeAudit(tx, viewer.id, { action: "DELETE", entity: "RoughPacket", entityId: packetId, before });
  });
  revalidatePath(`/rough/${packet.purchaseId}`);
  return {};
}

// Spreads the purchase cost over its packets (by carats, or equally per
// Settings), then on to the stones of every packet already lotted.
export async function allocatePurchaseCost(purchaseId: string): Promise<{ error?: string; info?: string }> {
  const viewer = await requirePermission("lots.manage");
  if (!can(viewer, "costs.view")) throw new ForbiddenError();

  try {
    const info = await prisma.$transaction(async (tx) => {
      const purchase = await tx.roughPurchase.findUniqueOrThrow({
        where: { id: purchaseId },
        include: { packets: { include: { lot: { select: { id: true } } }, orderBy: { packetCode: "asc" } } },
      });
      if (purchase.packets.length === 0) throw new AllocationError("Add the assortment packets first.");
      const setting = await tx.setting.findUnique({ where: { id: "singleton" }, select: { costAllocationMethod: true } });
      const weights =
        setting?.costAllocationMethod === "EQUAL"
          ? purchase.packets.map((p) => p.pieces)
          : purchase.packets.map((p) => Math.round(Number(p.carats) * 1000));
      const shares = allocateCents(toCents(purchase.totalAmount), weights);

      let stoneCount = 0;
      const pending: string[] = [];
      for (const [i, p] of purchase.packets.entries()) {
        await tx.roughPacket.update({ where: { id: p.id }, data: { costShare: centsToString(shares[i]) } });
        if (p.lot) {
          try {
            stoneCount += await allocateLotRough(tx, viewer.id, p.lot.id, {
              cents: shares[i],
              currency: purchase.currency,
              fxRate: purchase.fxRate?.toString() ?? null,
              date: purchase.date,
              sourceType: "ROUGH_PURCHASE",
              sourceId: p.id,
            });
          } catch (err) {
            if (err instanceof AllocationError) pending.push(`${p.packetCode}: ${err.message}`);
            else throw err;
          }
        }
      }
      await writeAudit(tx, viewer.id, {
        action: "UPDATE",
        entity: "RoughPurchase",
        entityId: purchaseId,
        after: { allocated: purchase.packets.map((p, i) => ({ packet: p.packetCode, share: centsToString(shares[i]) })) },
      });
      return (
        `Cost spread over ${purchase.packets.length} packet${purchase.packets.length === 1 ? "" : "s"}` +
        (stoneCount ? ` and ${stoneCount} stones` : "") +
        "." +
        (pending.length ? ` Not yet on stones — ${pending.join(" ")}` : "")
      );
    }, TX_OPTIONS);
    revalidatePath(`/rough/${purchaseId}`);
    return { info };
  } catch (err) {
    if (err instanceof AllocationError) return { error: err.message };
    throw err;
  }
}

const lotPacketSchema = z.object({
  packetId: zId,
  stoneCount: z.coerce.number().int().min(1, "At least 1 stone.").max(5000, "At most 5000 stones."),
});

// Puts a packet into production: creates its lot and numbered stones in
// Lotting, linked back to the packet and purchase.
export async function lotPacket(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("lots.manage");
  const parsed = parseInput(lotPacketSchema, {
    packetId: String(formData.get("packetId") ?? ""),
    stoneCount: String(formData.get("stoneCount") ?? ""),
  });
  if (!parsed.ok) return parsed.error;

  let lotId: string;
  try {
    lotId = await prisma.$transaction(async (tx) => {
      const packet = await tx.roughPacket.findUnique({
        where: { id: parsed.data.packetId },
        include: { lot: { select: { id: true } }, purchase: true },
      });
      if (!packet) throw new UserError("Packet not found.");
      if (packet.lot) throw new UserError("This packet already has a lot.");
      if (packet.purchase.voidedAt) throw new UserError("This purchase was cancelled.");
      if (!packet.purchase.kpCertNo) {
        throw new UserError("Add the Kimberley Process certificate number before the rough goes into production.");
      }
      const lot = await createLotWithStones(tx, viewer.id, {
        sourcePartyId: packet.purchase.partyId,
        roughWeight: Number(packet.carats),
        purchaseCost: null,
        stoneCount: parsed.data.stoneCount,
        packetId: packet.id,
        description: [packet.sizeRange, packet.quality, packet.model].filter(Boolean).join(" · ") || null,
      });
      return lot.id;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath("/lotting");
  revalidatePath("/rough");
  redirect(`/lotting/${lotId}`);
}

// Admin: cancels a purchase entered by mistake (only while nothing from it
// is in production).
export async function voidRoughPurchase(purchaseId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  const purchase = await prisma.roughPurchase.findUnique({
    where: { id: purchaseId },
    include: { packets: { include: { lot: { select: { id: true } } } } },
  });
  if (!purchase || purchase.voidedAt) return { error: "Purchase not found." };
  if (purchase.packets.some((p) => p.lot)) return { error: "Some packets are already in production — can't cancel." };
  await prisma.$transaction(async (tx) => {
    const after = await tx.roughPurchase.update({ where: { id: purchaseId }, data: { voidedAt: new Date() } });
    const { packets: _p, ...before } = purchase;
    await writeAudit(tx, viewer.id, { action: "VOID", entity: "RoughPurchase", entityId: purchaseId, before, after });
  });
  revalidatePath("/rough");
  revalidatePath(`/rough/${purchaseId}`);
  return {};
}

class UserError extends Error {}
