import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

const statusLabel: Record<string, string> = {
  ROUGH: "Rough",
  SAWING: "Sawing",
  CUTTING: "Cutting",
  POLISHING: "Polishing",
  COMPLETED: "Completed",
};

export default async function LotsReportPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
    include: { expenses: true, products: true },
  });

  const rows = lots.map((lot) => {
    const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
    const stockValue = lot.products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    return { lot, totalExpense, stockValue, margin: stockValue - totalExpense };
  });

  const grandTotalExpense = rows.reduce((sum, r) => sum + r.totalExpense, 0);
  const grandTotalValue = rows.reduce((sum, r) => sum + r.stockValue, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Every lot&apos;s total manufacturing spend against the current stock value of what it produced.
        </p>
        <a
          href="/api/export/reports/lots"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Lots" value={String(lots.length)} />
        <StatCard label="Total expenses" value={formatCurrency(grandTotalExpense)} />
        <StatCard label="Current stock value produced" value={formatCurrency(grandTotalValue)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Lot number</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">SKUs</th>
              <th className="px-4 py-3 font-medium">Total expenses</th>
              <th className="px-4 py-3 font-medium">Stock value</th>
              <th className="px-4 py-3 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No lots yet.
                </td>
              </tr>
            )}
            {rows.map(({ lot, totalExpense, stockValue, margin }) => (
              <tr key={lot.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/lots/${lot.id}`} className="font-medium text-zinc-900 hover:underline">
                    {lot.lotNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{statusLabel[lot.status]}</td>
                <td className="px-4 py-3 text-zinc-500">{lot.products.length}</td>
                <td className="px-4 py-3 text-zinc-800">{formatCurrency(totalExpense)}</td>
                <td className="px-4 py-3 text-zinc-800">{formatCurrency(stockValue)}</td>
                <td className={`px-4 py-3 font-medium ${margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(margin)}
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
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
