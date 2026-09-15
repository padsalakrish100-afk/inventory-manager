import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [parties, transactions] = await Promise.all([
    prisma.party.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ include: { product: true } }),
  ]);

  const byParty = new Map<
    string,
    { purchased: number; sold: number; count: number; lastActivity: Date | null }
  >();

  for (const t of transactions) {
    if (!t.partyId) continue;
    const entry = byParty.get(t.partyId) ?? { purchased: 0, sold: 0, count: 0, lastActivity: null };
    if (t.type === "IN") entry.purchased += t.quantity * t.product.costPrice;
    else entry.sold += t.quantity * t.product.sellingPrice;
    entry.count += 1;
    if (!entry.lastActivity || t.createdAt > entry.lastActivity) entry.lastActivity = t.createdAt;
    byParty.set(t.partyId, entry);
  }

  const csv = toCsv(
    ["Party", "Type", "Phone", "Email", "Purchased From (Cost)", "Sold To (Revenue)", "Transactions", "Last Activity"],
    parties.map((p) => {
      const e = byParty.get(p.id) ?? { purchased: 0, sold: 0, count: 0, lastActivity: null };
      return [
        p.name,
        p.type,
        p.phone ?? "",
        p.email ?? "",
        e.purchased,
        e.sold,
        e.count,
        e.lastActivity ? e.lastActivity.toISOString().slice(0, 10) : "",
      ];
    }),
  );

  return csvResponse(`party-ledger-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
