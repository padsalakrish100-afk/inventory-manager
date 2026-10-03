"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canWorkInDepartment, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { recordStoneEvents } from "@/lib/stone/events";
import { MANUAL_LOCATION_VALUES, STONE_LOCATION_LABELS } from "@/lib/stone/status";
import { dateInputToInstant } from "@/lib/dates";
import { getStages } from "@/lib/process-stages";
import { ensurePartyWithRole } from "@/lib/party";
import { saveAttachment, validateUpload } from "@/lib/storage";
import { propagateSplitCosts } from "@/lib/costing/allocate";
import { parseInput, zCarat, zDateString, zId, zOptionalText } from "@/lib/validation";

const moveSchema = z.object({
  stoneId: zId,
  location: z.enum(MANUAL_LOCATION_VALUES as [string, ...string[]], { message: "Choose a location." }),
  note: zOptionalText(300),
});

// Moves a stone between the places it can be put by hand (factory, office
// safe, in transit). Memo, lab, and sold locations come from their own flows.
export async function moveStoneLocation(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("stones.edit");

  const parsed = parseInput(moveSchema, {
    stoneId: String(formData.get("stoneId") ?? ""),
    location: String(formData.get("location") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.ok) return parsed.error;
  const { stoneId, location, note } = parsed.data;
  const target = location as (typeof MANUAL_LOCATION_VALUES)[number];

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id: stoneId } });
      if (!before) throw new UserError("Stone not found.");
      if (before.currentProcess || before.currentStageId) throw new UserError("This stone is out for a process — return it first.");
      if (["SOLD", "ON_MEMO", "SPLIT"].includes(before.status)) {
        throw new UserError("A sold, on-memo, or split stone can't be moved by hand.");
      }
      if (before.stockLocation === target) throw new UserError("The stone is already there.");

      const after = await tx.product.update({
        where: { id: stoneId },
        data: { stockLocation: target, locationPartyId: null },
      });
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Product", entityId: stoneId, before, after });
      await recordStoneEvents(tx, [
        {
          stoneId,
          type: "LOCATION",
          userId: viewer.id,
          summary: `Moved: ${STONE_LOCATION_LABELS[before.stockLocation]} → ${STONE_LOCATION_LABELS[target]}`,
          data: note ? { note } : undefined,
        },
      ]);
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath(`/stones/${stoneId}`);
  revalidatePath("/stones");
}

const breakageSchema = z.object({
  stoneId: zId,
  date: zDateString(),
  reason: z.string().trim().min(2, "Choose or type the reason.").max(300),
  weightBefore: zCarat("Weight before"),
  weightAfter: zCarat("Weight after"),
  totalLoss: z.boolean(),
  handledBy: zOptionalText(200),
  notes: zOptionalText(1000),
});

const MAX_PHOTOS = 4;

// Records a stone damaged in manufacturing: reason, weight before/after,
// who was handling it, and photos. The stone's weight drops to the "after"
// weight; a total loss marks the stone Broken.
export async function recordBreakage(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("mfg.issueReturn");

  const parsed = parseInput(breakageSchema, {
    stoneId: String(formData.get("stoneId") ?? ""),
    date: String(formData.get("date") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    weightBefore: String(formData.get("weightBefore") ?? ""),
    weightAfter: String(formData.get("weightAfter") ?? ""),
    totalLoss: formData.get("totalLoss") === "on",
    handledBy: String(formData.get("handledBy") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.weightAfter) > Number(d.weightBefore)) return "Weight after can't be more than weight before.";

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const thumbs = formData.getAll("thumbs").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) return `Attach at most ${MAX_PHOTOS} photos.`;
  for (const p of [...photos, ...thumbs]) {
    const problem = validateUpload(p, "image");
    if (problem) return problem;
  }

  const date = dateInputToInstant(d.date);
  const stages = await getStages();

  try {
    await prisma.$transaction(async (tx) => {
      const stone = await tx.product.findUnique({ where: { id: d.stoneId } });
      if (!stone) throw new UserError("Stone not found.");
      if (!["IN_PRODUCTION", "POLISHED"].includes(stone.status)) {
        throw new UserError("Breakage can only be recorded for a stone in production or just polished.");
      }
      const out = stone.currentStageId !== null || stone.currentProcess !== null;
      const stage = stages.find((s) => s.id === stone.currentStageId);
      if (out && !canWorkInDepartment(viewer, stage?.departmentId)) {
        throw new UserError("This stone is in another department.");
      }
      if (d.totalLoss && out) throw new UserError("Return the stone first, then record it as a total loss.");

      const openMovement = out
        ? await tx.processMovement.findFirst({
            where: { productId: stone.id, returnDate: null, voidedAt: null },
            orderBy: { issueDate: "desc" },
          })
        : null;
      const handler = d.handledBy ? await ensurePartyWithRole(tx, viewer.id, d.handledBy, "KARIGAR") : null;

      const breakage = await tx.breakage.create({
        data: {
          stoneId: stone.id,
          movementId: openMovement?.id ?? null,
          date,
          reason: d.reason,
          weightBefore: d.weightBefore,
          weightAfter: d.weightAfter,
          totalLoss: d.totalLoss,
          handledByPartyId: handler?.id ?? openMovement?.partyId ?? null,
          recordedById: viewer.id,
          notes: d.notes,
        },
      });

      for (const [i, photo] of photos.entries()) {
        await saveAttachment(tx, {
          entityType: "BREAKAGE",
          entityId: breakage.id,
          kind: "PHOTO",
          file: photo,
          thumb: thumbs[i] ?? null,
          uploadedById: viewer.id,
        });
      }

      const after = await tx.product.update({
        where: { id: stone.id },
        data: { caratWeight: Number(d.weightAfter), ...(d.totalLoss ? { status: "BROKEN" } : {}) },
      });

      await writeAudit(tx, viewer.id, [
        { action: "CREATE", entity: "Breakage", entityId: breakage.id, after: { ...breakage, photos: photos.length } },
        { action: "UPDATE", entity: "Product", entityId: stone.id, before: stone, after },
      ]);
      await recordStoneEvents(tx, [
        {
          stoneId: stone.id,
          type: "BREAKAGE",
          at: date,
          userId: viewer.id,
          partyId: breakage.handledByPartyId,
          weightBefore: d.weightBefore,
          weightAfter: d.weightAfter,
          refType: "Breakage",
          refId: breakage.id,
          summary: `${d.totalLoss ? "Total loss" : "Breakage"}: ${d.reason}`,
          data: d.notes ? { note: d.notes } : undefined,
        },
      ]);
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath(`/stones/${d.stoneId}`);
  revalidatePath("/manufacturing/breakage");
  redirect(`/stones/${d.stoneId}`);
}

const splitSchema = z.object({
  stoneId: zId,
  date: zDateString(),
  notes: zOptionalText(1000),
  children: z
    .array(zCarat("Child weight"))
    .min(2, "A split makes at least 2 stones.")
    .max(10, "A split makes at most 10 stones."),
});

function letterSuffix(index: number): string {
  // A..Z, then AA, AB, ...
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// Splits one rough stone into 2–10 child stones, each with its own number
// (parent number + A, B, C…), linked to the parent. Each child's rough
// weight is the parent's shared by weight; the parent is marked Split.
export async function splitStone(input: {
  stoneId: string;
  date: string;
  notes: string;
  children: string[];
}): Promise<{ error?: string; childIds?: string[] }> {
  const viewer = await requirePermission("stones.edit");
  const parsed = parseInput(splitSchema, input);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;
  if (d.children.some((w) => Number(w) <= 0)) return { error: "Every child stone needs a weight above zero." };
  const date = dateInputToInstant(d.date);

  try {
    const childIds = await prisma.$transaction(async (tx) => {
      const parent = await tx.product.findUnique({
        where: { id: d.stoneId },
        include: { polishedStone: { select: { id: true } } },
      });
      if (!parent) throw new UserError("Stone not found.");
      if (parent.currentStageId || parent.currentProcess) throw new UserError("Return the stone before splitting it.");
      if (parent.polishedStone || parent.status !== "IN_PRODUCTION") {
        throw new UserError("Only a stone in production can be split.");
      }

      // Thousandths of a carat, so shares add up exactly.
      const childMilli = d.children.map((w) => Math.round(Number(w) * 1000));
      const totalMilli = childMilli.reduce((a, b) => a + b, 0);
      const parentMilli = parent.caratWeight !== null ? Math.round(parent.caratWeight * 1000) : null;
      if (parentMilli !== null && totalMilli > parentMilli) {
        throw new UserError(`Children total ${(totalMilli / 1000).toFixed(3)} ct — more than the stone's ${parent.caratWeight} ct.`);
      }
      const roughMilli = parent.roughWeight !== null ? Math.round(Number(parent.roughWeight) * 1000) : null;

      const existing = new Set(
        (await tx.product.findMany({ where: { sku: { startsWith: `${parent.sku}-` } }, select: { sku: true } })).map(
          (p) => p.sku,
        ),
      );
      const skus: string[] = [];
      for (let i = 0; skus.length < childMilli.length; i++) {
        const sku = `${parent.sku}-${letterSuffix(i)}`;
        if (!existing.has(sku)) skus.push(sku);
      }

      let roughAllocated = 0;
      const ids: string[] = [];
      for (const [i, milli] of childMilli.entries()) {
        const isLast = i === childMilli.length - 1;
        const roughShare =
          roughMilli === null
            ? null
            : isLast
              ? roughMilli - roughAllocated
              : Math.round((roughMilli * milli) / totalMilli);
        if (roughShare !== null) roughAllocated += roughShare;

        const child = await tx.product.create({
          data: {
            sku: skus[i],
            name: skus[i],
            unit: "pcs",
            stock: 1,
            lotId: parent.lotId,
            parentId: parent.id,
            caratWeight: milli / 1000,
            roughWeight: roughShare !== null ? (roughShare / 1000).toFixed(3) : null,
            status: "IN_PRODUCTION",
            stockLocation: parent.stockLocation,
          },
        });
        ids.push(child.id);
      }

      const split = await tx.stoneSplit.create({
        data: {
          parentId: parent.id,
          date,
          parentWeight: parent.caratWeight !== null ? parent.caratWeight.toFixed(3) : (totalMilli / 1000).toFixed(3),
          childWeight: (totalMilli / 1000).toFixed(3),
          recordedById: viewer.id,
          notes: d.notes,
        },
      });
      const { polishedStone: _ps, ...parentBefore } = parent;
      const parentAfter = await tx.product.update({ where: { id: parent.id }, data: { status: "SPLIT" } });
      // The parent's whole cost so far (rough, labour, …) moves to the children by weight.
      await propagateSplitCosts(tx, viewer.id, parent.id);

      await writeAudit(tx, viewer.id, [
        { action: "CREATE", entity: "StoneSplit", entityId: split.id, after: { ...split, children: skus } },
        { action: "UPDATE", entity: "Product", entityId: parent.id, before: parentBefore, after: parentAfter },
        { action: "BULK_CREATE", entity: "Product", entityId: parent.id, after: { splitFrom: parent.sku, children: skus } },
      ]);
      await recordStoneEvents(tx, [
        {
          stoneId: parent.id,
          type: "SPLIT",
          at: date,
          userId: viewer.id,
          weightBefore: parent.caratWeight,
          weightAfter: totalMilli / 1000,
          refType: "StoneSplit",
          refId: split.id,
          summary: `Split into ${skus.length} stones: ${skus.join(", ")}`,
          data: d.notes ? { note: d.notes } : undefined,
        },
        ...ids.map((id, i) => ({
          stoneId: id,
          type: "CREATED" as const,
          at: date,
          userId: viewer.id,
          weightAfter: childMilli[i] / 1000,
          refType: "StoneSplit",
          refId: split.id,
          summary: `Split from ${parent.sku}`,
        })),
      ]);
      return ids;
    }, TX_OPTIONS);

    revalidatePath(`/stones/${d.stoneId}`);
    revalidatePath("/stones");
    return { childIds };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

class UserError extends Error {}
