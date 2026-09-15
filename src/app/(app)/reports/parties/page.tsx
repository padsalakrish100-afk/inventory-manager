import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function PartiesReportPage() {
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

  const rows = parties.map((p) => ({
    party: p,
    ...(byParty.get(p.id) ?? { purchased: 0, sold: 0, count: 0, lastActivity: null }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Total bought from and sold to each contact, valued at products&apos; current prices.
        </p>
        <a
          href="/api/export/reports/parties"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Purchased from (cost)</th>
              <th className="px-4 py-3 font-medium">Sold to (revenue)</th>
              <th className="px-4 py-3 font-medium">Transactions</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No contacts yet.
                </td>
              </tr>
            )}
            {rows.map(({ party, purchased, sold, count, lastActivity }) => (
              <tr key={party.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 text-zinc-900">{party.name}</td>
                <td className="px-4 py-3 text-zinc-800">{formatCurrency(purchased)}</td>
                <td className="px-4 py-3 text-zinc-800">{formatCurrency(sold)}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {count > 0 ? (
                    <Link href={`/transactions?partyId=${party.id}`} className="hover:underline">
                      {count}
                    </Link>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {lastActivity ? lastActivity.toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
