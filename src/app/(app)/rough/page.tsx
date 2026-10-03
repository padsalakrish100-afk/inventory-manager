import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export default async function RoughPurchasesPage() {
  const viewer = await requirePagePermission("lots.manage");
  const showCosts = can(viewer, "costs.view");

  const purchases = await prisma.roughPurchase.findMany({
    include: {
      party: { select: { name: true } },
      packets: { select: { carats: true, pieces: true, lot: { select: { id: true } } } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Rough purchases</h1>
          <p className="mt-1 text-sm text-zinc-500">Purchase → assortment packets → lots in production.</p>
        </div>
        {showCosts && (
          <Link
            href="/rough/new"
            className="min-h-10 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            New purchase
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Purchase</th>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium text-right">Carats / pcs</th>
              <th className="px-4 py-2 font-medium">Assorted</th>
              <th className="px-4 py-2 font-medium">KP</th>
              {showCosts && <th className="px-4 py-2 font-medium text-right">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={showCosts ? 6 : 5} className="px-4 py-6 text-center text-zinc-500">
                  No purchases yet.
                </td>
              </tr>
            )}
            {purchases.map((p) => {
              const assorted = p.packets.reduce((s, k) => s + Number(k.carats), 0);
              const lotted = p.packets.filter((k) => k.lot).length;
              return (
                <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                  <td className="px-4 py-2">
                    <Link href={`/rough/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                      {p.purchaseNo}
                    </Link>
                    <span className="block text-xs text-zinc-500">{formatDate(p.date)}</span>
                  </td>
                  <td className="px-4 py-2">
                    {p.party.name}
                    {p.source && <span className="block text-xs text-zinc-500">{p.source}</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {Number(p.totalCarats).toFixed(3)} ct · {p.pieces} pc
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {p.packets.length === 0
                      ? "Not yet"
                      : `${p.packets.length} packets · ${assorted.toFixed(3)} ct · ${lotted} lotted`}
                  </td>
                  <td className="px-4 py-2">{p.kpCertNo ? "✓" : <span className="text-red-600">Missing</span>}</td>
                  {showCosts && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">{formatMoney(Number(p.totalAmount), p.currency)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
