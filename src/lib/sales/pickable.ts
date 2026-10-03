import "server-only";
import { prisma } from "@/lib/prisma";
import type { PickableStone } from "@/components/stone-picker";
import { caratsOf, describeStone } from "@/lib/sales/stones";

// Stones a memo or invoice can include: everything in stock, plus (for
// invoices) stones out on memo, which can be sold to that memo's customer.
export async function pickableStones(opts: { includeOnMemo: boolean }): Promise<PickableStone[]> {
  const stones = await prisma.product.findMany({
    where: {
      polishedStone: { isNot: null },
      status: { in: opts.includeOnMemo ? ["IN_STOCK", "ON_MEMO"] : ["IN_STOCK"] },
    },
    include: {
      polishedStone: true,
      salesMemoLines: {
        where: { status: "OUT", memo: { voidedAt: null } },
        include: { memo: { select: { memoNo: true, currency: true, party: { select: { name: true } } } } },
      },
    },
    orderBy: { polishedStone: { stockId: "asc" } },
    take: 2000,
  });
  return stones.map((s) => {
    const p = s.polishedStone!;
    const m = s.status === "ON_MEMO" ? s.salesMemoLines[0] : undefined;
    return {
      stoneId: s.id,
      stockId: p.stockId,
      description: describeStone(p),
      carats: caratsOf(p, s),
      askingTotal: p.askingPrice !== null ? p.askingPrice.toFixed(2) : null,
      askingCurrency: p.currency,
      memo: m
        ? { lineId: m.id, memoNo: m.memo.memoNo, partyName: m.memo.party.name, amount: m.amount.toString(), currency: m.memo.currency }
        : null,
    };
  });
}

export async function customerNames(): Promise<string[]> {
  const parties = await prisma.party.findMany({
    where: { roles: { has: "CUSTOMER" }, active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return parties.map((p) => p.name);
}
