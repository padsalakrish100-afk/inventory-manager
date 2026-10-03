import "server-only";
import type { CostType } from "@/generated/prisma/client";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { inBothCurrencies, toCents } from "@/lib/money";

export type CostLine = {
  id: string;
  kind: "entry" | "labour";
  type: CostType;
  date: Date;
  amount: string;
  currency: string;
  fxRate: string | null;
  usd: string | null;
  inr: string | null;
  sourceType: string;
  note: string | null;
};

export type StoneCost = {
  lines: CostLine[];
  usdCents: number;
  inrCents: number;
  // Lines that couldn't be converted (no exchange rate recorded).
  missingUsd: number;
  missingInr: number;
  byType: Partial<Record<CostType, { usdCents: number; inrCents: number }>>;
};

function emptyCost(): StoneCost {
  return { lines: [], usdCents: 0, inrCents: 0, missingUsd: 0, missingInr: 0, byType: {} };
}

// Every cost a stone carries: ledger rows plus karigar labour (read live
// from labour entries so they can never drift apart).
export async function stoneCosts(db: Tx | typeof prisma, stoneIds: string[]): Promise<Map<string, StoneCost>> {
  const result = new Map<string, StoneCost>(stoneIds.map((id) => [id, emptyCost()]));
  if (stoneIds.length === 0) return result;

  const [entries, labour] = await Promise.all([
    db.costEntry.findMany({
      where: { stoneId: { in: stoneIds }, voidedAt: null },
      orderBy: { date: "asc" },
    }),
    db.labourEntry.findMany({
      where: { voidedAt: null, movement: { productId: { in: stoneIds } } },
      select: {
        id: true,
        workDate: true,
        amount: true,
        currency: true,
        fxRate: true,
        source: true,
        stage: { select: { name: true } },
        movement: { select: { productId: true } },
      },
      orderBy: { workDate: "asc" },
    }),
  ]);

  const add = (stoneId: string, line: CostLine) => {
    const c = result.get(stoneId)!;
    c.lines.push(line);
    const t = (c.byType[line.type] ??= { usdCents: 0, inrCents: 0 });
    if (line.usd !== null) {
      c.usdCents += toCents(line.usd);
      t.usdCents += toCents(line.usd);
    } else c.missingUsd++;
    if (line.inr !== null) {
      c.inrCents += toCents(line.inr);
      t.inrCents += toCents(line.inr);
    } else c.missingInr++;
  };

  for (const e of entries) {
    add(e.stoneId, {
      id: e.id,
      kind: "entry",
      type: e.type,
      date: e.date,
      amount: e.amount.toString(),
      currency: e.currency,
      fxRate: e.fxRate?.toString() ?? null,
      usd: e.amountUsd?.toString() ?? null,
      inr: e.amountInr?.toString() ?? null,
      sourceType: e.sourceType,
      note: e.note,
    });
  }
  for (const l of labour) {
    const both = inBothCurrencies(l.amount, l.currency, l.fxRate);
    add(l.movement.productId, {
      id: l.id,
      kind: "labour",
      type: "LABOUR",
      date: l.workDate,
      amount: l.amount.toString(),
      currency: l.currency,
      fxRate: l.fxRate?.toString() ?? null,
      usd: both.usd,
      inr: both.inr,
      sourceType: "LABOUR_ENTRY",
      note: l.stage?.name ?? null,
    });
  }
  for (const c of result.values()) c.lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

export const COST_TYPE_LABELS: Record<CostType, string> = {
  ROUGH: "Rough",
  LABOUR: "Labour",
  JOB_WORK: "Job-work",
  CERTIFICATION: "Certification",
  OTHER: "Other",
  OVERHEAD: "Overhead",
};

export const COST_SOURCE_LABELS: Record<string, string> = {
  ROUGH_PURCHASE: "Rough purchase",
  LOT_ALLOCATION: "Lot purchase cost",
  JOB_WORK_BILL: "Job-work bill",
  OVERHEAD_POOL: "Monthly overhead",
  SPLIT: "From parent stone",
  MANUAL: "Entered by hand",
  LEGACY_POLISH: "Old Polish form",
  LABOUR_ENTRY: "Karigar labour",
};
