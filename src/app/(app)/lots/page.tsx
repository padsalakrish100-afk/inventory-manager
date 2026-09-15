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

const statusStyle: Record<string, string> = {
  ROUGH: "bg-zinc-100 text-zinc-600",
  SAWING: "bg-amber-50 text-amber-700",
  CUTTING: "bg-amber-50 text-amber-700",
  POLISHING: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

export default async function LotsPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
    include: { expenses: true, products: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lots</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rough-to-polish batches, their expenses, and the SKUs they produced.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/export/lot-expenses"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Export expenses CSV
          </a>
          <Link
            href="/lots/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            New lot
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Lot number</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rough weight</th>
              <th className="px-4 py-3 font-medium">SKUs produced</th>
              <th className="px-4 py-3 font-medium">Total expenses</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No lots yet.{" "}
                  <Link href="/lots/new" className="underline">
                    Create your first lot
                  </Link>
                  .
                </td>
              </tr>
            )}
            {lots.map((lot) => {
              const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
              return (
                <tr key={lot.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/lots/${lot.id}`} className="font-medium text-zinc-900 hover:underline">
                      {lot.lotNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[lot.status]}`}>
                      {statusLabel[lot.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {lot.roughWeight !== null ? `${lot.roughWeight} ct` : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{lot.products.length}</td>
                  <td className="px-4 py-3 text-zinc-800">{formatCurrency(totalExpense)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
