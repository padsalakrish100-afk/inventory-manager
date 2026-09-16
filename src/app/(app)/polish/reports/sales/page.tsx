import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES, computeTotalCost } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; buyerId?: string }>;
}) {
  const { from, to, buyerId } = await searchParams;

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const [stones, buyers] = await Promise.all([
    prisma.polishedStone.findMany({
      where: {
        status: "SOLD",
        buyerId: buyerId || undefined,
        soldDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: { buyer: true },
      orderBy: { soldDate: "desc" },
    }),
    prisma.party.findMany({
      where: { polishedStonesBought: { some: {} } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = stones.map((p) => {
    const totalCost = computeTotalCost(p);
    const margin = p.soldPrice !== null ? p.soldPrice - totalCost : null;
    return { stone: p, totalCost, margin };
  });

  function sumByCurrency(items: { value: number | null; currency: string }[]) {
    const totals = new Map<string, number>();
    for (const { value, currency } of items) {
      if (value === null) continue;
      totals.set(currency, (totals.get(currency) ?? 0) + value);
    }
    return totals;
  }

  const totalRevenue = sumByCurrency(rows.map((r) => ({ value: r.stone.soldPrice, currency: r.stone.currency })));
  const totalMargin = sumByCurrency(rows.map((r) => ({ value: r.margin, currency: r.stone.currency })));

  function formatTotals(totals: Map<string, number>) {
    if (totals.size === 0) return "—";
    return [...totals.entries()].map(([currency, total]) => formatMoney(total, currency)).join(" · ");
  }

  const hasFilters = Boolean(from || to || buyerId);
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (buyerId) exportParams.set("buyerId", buyerId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Sales report</h1>
          <p className="mt-1 text-sm text-zinc-500">Sold stones, revenue, and margin.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons report="polish-sales" params={exportParams} />
          <Link href="/polish/summary" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Back to summary
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Sold from</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Sold to</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Buyer</label>
          <select
            name="buyerId"
            defaultValue={buyerId ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All buyers</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/polish/reports/sales" className="text-sm text-zinc-500 hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total revenue" value={formatTotals(totalRevenue)} />
        <StatCard label="Total margin" value={formatTotals(totalMargin)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stock ID</th>
              <th className="px-4 py-3 font-medium">Buyer</th>
              <th className="px-4 py-3 font-medium">Sold date</th>
              <th className="px-4 py-3 font-medium">Sold price</th>
              <th className="px-4 py-3 font-medium">Total cost</th>
              <th className="px-4 py-3 font-medium">Margin</th>
              <th className="px-4 py-3 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  {hasFilters ? (
                    <>
                      No sales match this filter.{" "}
                      <Link href="/polish/reports/sales" className="underline">
                        Clear filters
                      </Link>
                      .
                    </>
                  ) : (
                    "No sales recorded yet."
                  )}
                </td>
              </tr>
            )}
            {rows.map(({ stone, totalCost, margin }) => (
              <tr key={stone.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/polish/${stone.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                    {stone.stockId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-800">{stone.buyer?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {stone.soldDate ? stone.soldDate.toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-800">
                  {stone.soldPrice !== null ? formatMoney(stone.soldPrice, stone.currency) : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatMoney(totalCost, stone.currency)}</td>
                <td className={`px-4 py-3 font-medium ${margin !== null && margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {margin !== null ? formatMoney(margin, stone.currency) : "—"}
                </td>
                <td className="px-4 py-3">
                  {stone.paymentStatus ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_STYLES[stone.paymentStatus]}`}>
                      {PAYMENT_STATUS_LABELS[stone.paymentStatus]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
