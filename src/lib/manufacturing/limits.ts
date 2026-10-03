import "server-only";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// The allowed loss % for a return: a karigar-specific limit for this stage
// (latest effective on the date) beats the stage's default. Null = no limit.
export async function resolveLossLimit(
  db: Tx | typeof prisma,
  stageId: string | null,
  partyId: string | null,
  date: Date,
): Promise<string | null> {
  if (!stageId) return null;
  if (partyId) {
    const specific = await db.lossLimit.findFirst({
      where: { stageId, partyId, effectiveFrom: { lte: date } },
      orderBy: { effectiveFrom: "desc" },
      select: { allowedPct: true },
    });
    if (specific) return specific.allowedPct.toString();
  }
  const stage = await db.processStage.findUnique({ where: { id: stageId }, select: { defaultLossLimitPct: true } });
  return stage?.defaultLossLimitPct?.toString() ?? null;
}
