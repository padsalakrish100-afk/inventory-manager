import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POLISH_STATUS_LABELS, POLISH_STATUS_STYLES, daysInStock } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";

export default async function StockAgingReportPage() {
  const stones = await prisma.polishedStone.findMany({
    where: { status: { not: "SOLD" } },
  });

  const rows = stones
    .map((p) => ({ ...p, days: daysInStock(p.createdAt) }))
    .sort((a, b) => b.days - a.days);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Stock aging</h1>
          <p className="mt-1 text-sm text-zinc-500">Every unsold stone, oldest first.</p>
        </div>
        <Link href="/polish/summary" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Back to summary
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stock ID</th>
              <th className="px-4 py-3 font-medium">Shape</th>
              <th className="px-4 py-3 font-medium">Carat</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Asking price</th>
              <th className="px-4 py-3 font-medium">Days in stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  Nothing unsold right now.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/polish/${p.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                    {p.stockId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.shape ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${POLISH_STATUS_STYLES[p.status]}`}>
                    {POLISH_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.location ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-800">
                  {p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900">{p.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
