import "server-only";
import { writeAudit, type Tx } from "@/lib/audit";
import { recordStoneEvents } from "@/lib/stone/events";

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

// Creates a lot and its numbered stones (LOT-2026-001-0001, …) — used by
// Lotting directly and by "Lot this packet" on a rough purchase.
export async function createLotWithStones(
  tx: Tx,
  userId: string,
  input: {
    sourcePartyId: string;
    roughWeight: number | null;
    purchaseCost: number | null;
    stoneCount: number;
    packetId?: string | null;
    description?: string | null;
  },
): Promise<{ id: string; lotNumber: string }> {
  const lotNumber = await nextLotNumber(tx);
  const lot = await tx.lot.create({
    data: {
      lotNumber,
      roughWeight: input.roughWeight,
      purchaseCost: input.purchaseCost,
      sourcePartyId: input.sourcePartyId,
      packetId: input.packetId ?? null,
      description: input.description ?? null,
    },
  });

  const skus = Array.from({ length: input.stoneCount }, (_, i) => `${lotNumber}-${String(i + 1).padStart(4, "0")}`);
  await tx.product.createMany({ data: skus.map((sku) => ({ sku, name: sku, unit: "pcs", stock: 1, lotId: lot.id })) });
  const created = await tx.product.findMany({ where: { lotId: lot.id }, select: { id: true } });

  await recordStoneEvents(
    tx,
    created.map((p) => ({
      stoneId: p.id,
      type: "CREATED" as const,
      userId,
      refType: "Lot",
      refId: lot.id,
      summary: `Created in lot ${lotNumber}`,
    })),
  );
  await writeAudit(tx, userId, [
    { action: "CREATE", entity: "Lot", entityId: lot.id, after: lot },
    {
      action: "BULK_CREATE",
      entity: "Product",
      entityId: lot.id,
      after: { lotId: lot.id, count: skus.length, first: skus[0], last: skus[skus.length - 1] },
    },
  ]);
  return { id: lot.id, lotNumber };
}
