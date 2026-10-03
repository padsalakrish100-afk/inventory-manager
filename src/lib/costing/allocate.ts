import "server-only";
import { num, num0 } from "@/lib/decimal";
import type { CostType } from "@/generated/prisma/client";
import { writeAudit, type Tx } from "@/lib/audit";
import { allocateCents, centsToString, inBothCurrencies, toCents } from "@/lib/money";
import { stoneCosts } from "@/lib/costing/ledger";

export class AllocationError extends Error {}

// Stones among these that were split pass their new cost on to children.
async function propagateWhereSplit(tx: Tx, userId: string | null, stoneIds: string[]): Promise<void> {
  const parents = await tx.product.findMany({
    where: { id: { in: stoneIds }, children: { some: {} } },
    select: { id: true },
  });
  for (const p of parents) await propagateSplitCosts(tx, userId, p.id);
}

type NewEntry = {
  stoneId: string;
  type: CostType;
  date: Date;
  cents: number;
  currency: string;
  fxRate: string | null;
  sourceType: string;
  sourceId: string | null;
  allocatedFromStoneId?: string | null;
  note?: string | null;
};

export async function createCostEntries(tx: Tx, userId: string | null, rows: NewEntry[]): Promise<number> {
  const data = rows
    .filter((r) => r.cents !== 0)
    .map((r) => {
      const amount = centsToString(r.cents);
      const both = inBothCurrencies(amount, r.currency, r.fxRate);
      return {
        stoneId: r.stoneId,
        type: r.type,
        date: r.date,
        amount,
        currency: r.currency,
        fxRate: r.fxRate,
        amountUsd: both.usd,
        amountInr: both.inr,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        allocatedFromStoneId: r.allocatedFromStoneId ?? null,
        note: r.note ?? null,
        createdById: userId,
      };
    });
  if (data.length) await tx.costEntry.createMany({ data });
  return data.length;
}

async function voidEntries(tx: Tx, where: Parameters<Tx["costEntry"]["updateMany"]>[0]["where"]): Promise<number> {
  const r = await tx.costEntry.updateMany({ where: { ...where, voidedAt: null }, data: { voidedAt: new Date() } });
  return r.count;
}

async function allocationMethod(tx: Tx): Promise<"WEIGHT" | "EQUAL"> {
  const s = await tx.setting.findUnique({ where: { id: "singleton" }, select: { costAllocationMethod: true } });
  return s?.costAllocationMethod === "EQUAL" ? "EQUAL" : "WEIGHT";
}

// A shared amount divided over stones by weight (or equally, per Settings).
async function weightsFor(
  tx: Tx,
  stones: { id: string; sku: string; weight: number | null }[],
): Promise<number[]> {
  if ((await allocationMethod(tx)) === "EQUAL") return stones.map(() => 1);
  const missing = stones.filter((s) => !s.weight || s.weight <= 0);
  if (missing.length) {
    throw new AllocationError(
      `Enter the weight of ${missing.length} stone${missing.length === 1 ? "" : "s"} first (e.g. ${missing
        .slice(0, 3)
        .map((s) => s.sku)
        .join(", ")}).`,
    );
  }
  return stones.map((s) => Math.round((s.weight ?? 0) * 1000));
}

// Rough cost of a lot → its stones, by rough weight. Replaces any earlier
// rough allocation for those stones (and rough typed on the old Polish
// form), then passes cost on to children of stones already split.
export async function allocateLotRough(
  tx: Tx,
  userId: string,
  lotId: string,
  cost: { cents: number; currency: string; fxRate: string | null; date: Date; sourceType: "ROUGH_PURCHASE" | "LOT_ALLOCATION"; sourceId: string },
): Promise<number> {
  const stones = await tx.product.findMany({
    where: { lotId, parentId: null, deletedAt: null },
    select: { id: true, sku: true, roughWeight: true, caratWeight: true, _count: { select: { children: true } } },
    orderBy: { sku: "asc" },
  });
  if (stones.length === 0) throw new AllocationError("This lot has no stones.");

  const weights = await weightsFor(
    tx,
    stones.map((s) => ({ id: s.id, sku: s.sku, weight: s.roughWeight !== null ? Number(s.roughWeight) : num(s.caratWeight) })),
  );
  const parts = allocateCents(cost.cents, weights);

  const ids = stones.map((s) => s.id);
  const voided = await voidEntries(tx, {
    stoneId: { in: ids },
    type: "ROUGH",
    sourceType: { in: ["ROUGH_PURCHASE", "LOT_ALLOCATION", "LEGACY_POLISH", "MANUAL"] },
  });
  const created = await createCostEntries(
    tx,
    userId,
    stones.map((s, i) => ({
      stoneId: s.id,
      type: "ROUGH" as const,
      date: cost.date,
      cents: parts[i],
      currency: cost.currency,
      fxRate: cost.fxRate,
      sourceType: cost.sourceType,
      sourceId: cost.sourceId,
    })),
  );
  for (const s of stones) if (s._count.children > 0) await propagateSplitCosts(tx, userId, s.id);

  await writeAudit(tx, userId, {
    action: "BULK_CREATE",
    entity: "CostEntry",
    entityId: lotId,
    after: { kind: "rough allocation", lotId, amount: centsToString(cost.cents), currency: cost.currency, stones: created, replaced: voided },
  });
  return created;
}

// A split parent's whole cost (every ledger line and its labour) passed to
// its children by weight. Re-run whenever the parent's cost changes;
// grandchildren are updated in turn.
export async function propagateSplitCosts(tx: Tx, userId: string | null, parentId: string): Promise<void> {
  const children = await tx.product.findMany({
    where: { parentId },
    select: { id: true, caratWeight: true, _count: { select: { children: true } } },
    orderBy: { sku: "asc" },
  });
  if (children.length === 0) return;

  await voidEntries(tx, { stoneId: { in: children.map((c) => c.id) }, sourceType: "SPLIT", allocatedFromStoneId: parentId });

  const parentCost = (await stoneCosts(tx, [parentId])).get(parentId)!;
  const weights = children.map((c) => Math.round(num0(c.caratWeight) * 1000));
  const rows: NewEntry[] = [];
  for (const line of parentCost.lines) {
    const parts = allocateCents(toCents(line.amount), weights);
    children.forEach((c, i) =>
      rows.push({
        stoneId: c.id,
        type: line.type,
        date: line.date,
        cents: parts[i],
        currency: line.currency,
        fxRate: line.fxRate,
        sourceType: "SPLIT",
        sourceId: line.id,
        allocatedFromStoneId: parentId,
      }),
    );
  }
  await createCostEntries(tx, userId, rows);
  for (const c of children) if (c._count.children > 0) await propagateSplitCosts(tx, userId, c.id);
}

// A job-work bill → the stones it covered, by weight issued.
export async function allocateJobWorkBill(tx: Tx, userId: string, billId: string): Promise<number> {
  const bill = await tx.jobWorkBill.findUniqueOrThrow({
    where: { id: billId },
    include: { movements: { select: { productId: true, issueWeight: true, product: { select: { sku: true } } } } },
  });
  await voidEntries(tx, { sourceType: "JOB_WORK_BILL", sourceId: billId });
  if (bill.voidedAt || bill.movements.length === 0) {
    await propagateWhereSplit(tx, userId, bill.movements.map((m) => m.productId));
    return 0;
  }

  const weights = await weightsFor(
    tx,
    bill.movements.map((m) => ({ id: m.productId, sku: m.product.sku, weight: num(m.issueWeight) })),
  );
  const parts = allocateCents(toCents(bill.amount), weights);
  const created = await createCostEntries(
    tx,
    userId,
    bill.movements.map((m, i) => ({
      stoneId: m.productId,
      type: "JOB_WORK" as const,
      date: bill.date,
      cents: parts[i],
      currency: bill.currency,
      fxRate: bill.fxRate?.toString() ?? null,
      sourceType: "JOB_WORK_BILL",
      sourceId: bill.id,
      note: `Bill ${bill.billNo}`,
    })),
  );
  await propagateWhereSplit(tx, userId, bill.movements.map((m) => m.productId));
  return created;
}

// A month's overhead → the stones returned that month, by carats issued.
export async function allocateOverhead(tx: Tx, userId: string, poolId: string): Promise<number> {
  const pool = await tx.overheadPool.findUniqueOrThrow({ where: { id: poolId } });
  const previous = await tx.costEntry.findMany({
    where: { sourceType: "OVERHEAD_POOL", sourceId: poolId, voidedAt: null },
    select: { stoneId: true },
  });
  await voidEntries(tx, { sourceType: "OVERHEAD_POOL", sourceId: poolId });
  if (pool.voidedAt) {
    await propagateWhereSplit(tx, userId, previous.map((p) => p.stoneId));
    return 0;
  }

  // pool.month is the 1st of the month (date only); the month runs in IST.
  const y = pool.month.getUTCFullYear();
  const m = pool.month.getUTCMonth();
  const start = new Date(`${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+05:30`);
  const next = m === 11 ? `${y + 1}-01` : `${y}-${String(m + 2).padStart(2, "0")}`;
  const end = new Date(`${next}-01T00:00:00+05:30`);

  const returns = await tx.processMovement.findMany({
    where: { voidedAt: null, returnDate: { gte: start, lt: end } },
    select: { productId: true, issueWeight: true, product: { select: { sku: true } } },
  });
  if (returns.length === 0) throw new AllocationError("No stones were returned in that month — nothing to spread the overhead over.");

  const byStone = new Map<string, { sku: string; weight: number }>();
  for (const r of returns) {
    const s = byStone.get(r.productId) ?? { sku: r.product.sku, weight: 0 };
    s.weight += num0(r.issueWeight);
    byStone.set(r.productId, s);
  }
  const stones = [...byStone.entries()].map(([id, s]) => ({ id, sku: s.sku, weight: s.weight }));
  const parts = allocateCents(toCents(pool.amount), await weightsFor(tx, stones));
  const created = await createCostEntries(
    tx,
    userId,
    stones.map((s, i) => ({
      stoneId: s.id,
      type: "OVERHEAD" as const,
      date: new Date(end.getTime() - 1),
      cents: parts[i],
      currency: pool.currency,
      fxRate: pool.fxRate?.toString() ?? null,
      sourceType: "OVERHEAD_POOL",
      sourceId: pool.id,
    })),
  );
  await tx.overheadPool.update({ where: { id: poolId }, data: { allocatedAt: new Date() } });
  await propagateWhereSplit(tx, userId, stones.map((s) => s.id));
  return created;
}
