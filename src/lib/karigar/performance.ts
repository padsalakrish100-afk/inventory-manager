import "server-only";
import { prisma } from "@/lib/prisma";

export type PerformanceLine = {
  partyId: string;
  name: string;
  returns: number;
  pieces: number;
  caratsIssued: number;
  caratsLost: number;
  avgLossPct: number | null; // weighted: total lost ÷ total issued
  excessCount: number;
  breakageCount: number;
  labourInr: number; // rupees (shown only to people who can see costs)
  pendingNow: number;
};

// Work completed (returned) per karigar in [start, end): pieces, carats,
// loss, excess-loss returns, breakage they were handling, labour earned.
export async function karigarPerformance(start: Date, end: Date, partyId?: string): Promise<PerformanceLine[]> {
  const partyFilter = partyId ? { partyId } : { partyId: { not: null } };
  const [returns, breakages, labour, pending] = await Promise.all([
    prisma.processMovement.findMany({
      where: { voidedAt: null, returnDate: { gte: start, lt: end }, ...partyFilter },
      select: {
        partyId: true,
        issueWeight: true,
        issuePieces: true,
        returnPieces: true,
        lossWeight: true,
        isExcessLoss: true,
        party: { select: { name: true, roles: true } },
      },
    }),
    prisma.breakage.groupBy({
      by: ["handledByPartyId"],
      where: { date: { gte: start, lt: end }, handledByPartyId: partyId ?? { not: null } },
      _count: true,
    }),
    prisma.labourEntry.groupBy({
      by: ["partyId"],
      where: { voidedAt: null, workDate: { gte: start, lt: end }, ...(partyId ? { partyId } : {}) },
      _sum: { amount: true },
    }),
    prisma.processMovement.groupBy({
      by: ["partyId"],
      where: { voidedAt: null, returnDate: null, ...partyFilter },
      _count: true,
    }),
  ]);

  const lines = new Map<string, PerformanceLine & { issuedForLoss: number }>();
  const ensure = (id: string, name: string) => {
    let l = lines.get(id);
    if (!l) {
      l = {
        partyId: id,
        name,
        returns: 0,
        pieces: 0,
        caratsIssued: 0,
        caratsLost: 0,
        avgLossPct: null,
        excessCount: 0,
        breakageCount: 0,
        labourInr: 0,
        pendingNow: 0,
        issuedForLoss: 0,
      };
      lines.set(id, l);
    }
    return l;
  };

  for (const m of returns) {
    if (!m.partyId || !m.party) continue;
    const l = ensure(m.partyId, m.party.name);
    l.returns++;
    l.pieces += m.returnPieces ?? m.issuePieces;
    l.caratsIssued += m.issueWeight ?? 0;
    if (m.lossWeight !== null && m.issueWeight) {
      l.caratsLost += Number(m.lossWeight);
      l.issuedForLoss += m.issueWeight;
    }
    if (m.isExcessLoss) l.excessCount++;
  }

  const names = new Map(
    (
      await prisma.party.findMany({
        where: {
          id: {
            in: [
              ...breakages.map((b) => b.handledByPartyId),
              ...labour.map((l) => l.partyId),
              ...pending.map((p) => p.partyId),
            ].filter((x): x is string => Boolean(x)),
          },
        },
        select: { id: true, name: true },
      })
    ).map((p) => [p.id, p.name]),
  );
  for (const b of breakages) if (b.handledByPartyId) ensure(b.handledByPartyId, names.get(b.handledByPartyId) ?? "?").breakageCount = b._count;
  for (const lab of labour) ensure(lab.partyId, names.get(lab.partyId) ?? "?").labourInr = Number(lab._sum.amount ?? 0);
  for (const p of pending) if (p.partyId && lines.has(p.partyId)) lines.get(p.partyId)!.pendingNow = p._count;

  return [...lines.values()]
    .map(({ issuedForLoss, ...l }) => ({
      ...l,
      avgLossPct: issuedForLoss > 0 ? (l.caratsLost / issuedForLoss) * 100 : null,
    }))
    .sort((a, b) => b.caratsIssued - a.caratsIssued);
}
