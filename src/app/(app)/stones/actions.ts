"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { recordStoneEvents } from "@/lib/stone/events";
import { MANUAL_LOCATION_VALUES, STONE_LOCATION_LABELS } from "@/lib/stone/status";
import { parseInput, zId, zOptionalText } from "@/lib/validation";

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
      if (before.currentProcess) throw new UserError("This stone is out with a karigar — return it first.");
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

class UserError extends Error {}
