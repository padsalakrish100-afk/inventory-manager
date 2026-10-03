import "server-only";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// INR per 1 USD in force on a date: the latest rate entered on or before
// it (Settings → Exchange rates). Null when none has been entered yet.
export async function usdInrOn(db: Tx | typeof prisma, date: Date): Promise<string | null> {
  const row = await db.exchangeRate.findFirst({
    where: { date: { lte: date } },
    orderBy: { date: "desc" },
    select: { usdInr: true },
  });
  return row?.usdInr.toString() ?? null;
}
