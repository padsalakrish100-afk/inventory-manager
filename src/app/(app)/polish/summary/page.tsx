import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POLISH_STATUS_OPTIONS, POLISH_STATUS_LABELS, daysInStock } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";

export default async function PolishSummaryPage() {
  const stones = await prisma.polishedStone.findMany();

  const countByStatus = new Map<string, number>();
  for (const s of POLISH_STATUS_OPTIONS) countByStatus.set(s.value, 0);
  for (const p of stones) countByStatus.set(p.status, (countByStatus.get(p.status) ?? 0) + 1);

  function sumByCurrency(items: { value: number | null; currency: string }[]) {
    const totals = new Map<string, number>();
    for (const { value, currency } of items) {
      if (value === null) continue;
      totals.set(currency, (totals.get(currency) ?? 0) + value);
    }
    return totals;
  }

  const inventoryValue = sumByCurrency(
    stones
      .filter((p) => p.status === "AVAILABLE" || p.status === "RESERVED")
      .map((p) => ({ value: p.askingPrice, currency: p.currency })),
  );
  const soldValue = sumByCurrency(
    stones.filter((p) => p.status === "SOLD").map((p) => ({ value: p.soldPrice, currency: p.currency })),
  );

  const oldestUnsold = stones
    .filter((p) => p.status !== "SOLD")
    .map((p) => ({ ...p, days: daysInStock(p.createdAt) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  function formatTotals(totals: Map<string, number>) {
    if (totals.size === 0) return "—";
    return [...totals.entries()].map(([currency, total]) => formatMoney(total, currency)).join(" · ");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Polish summary</h1>
          <p className="mt-1 text-sm text-zinc-500">Inventory, sales, and what's been sitting longest.</p>
        </div>
        <Link href="/polish" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Back to list
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POLISH_STATUS_OPTIONS.map((s) => (
          <StatCard key={s.value} label={s.label} value={String(countByStatus.get(s.value) ?? 0)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Inventory value (available + reserved)" value={formatTotals(inventoryValue)} />
        <StatCard label="Total sold value" value={formatTotals(soldValue)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Reports</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ReportCard
            href="/polish/reports/aging"
            title="Stock aging"
            description="Every unsold stone, oldest first."
          />
          <ReportCard
            href="/polish/reports/inventory-value"
            title="Inventory value summary"
            description="Total value grouped by status."
          />
          <ReportCard
            href="/polish/reports/sales"
            title="Sales report"
            description="Sold stones by date range and buyer, with revenue and margin."
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Oldest unsold stones</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Stock ID</th>
                <th className="px-4 py-3 font-medium">Shape</th>
                <th className="px-4 py-3 font-medium">Carat</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Asking price</th>
                <th className="px-4 py-3 font-medium">Days in stock</th>
              </tr>
            </thead>
            <tbody>
              {oldestUnsold.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Nothing unsold right now.
                  </td>
                </tr>
              )}
              {oldestUnsold.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/polish/${p.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                      {p.stockId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.shape ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{POLISH_STATUS_LABELS[p.status]}</td>
                  <td className="px-4 py-3 text-zinc-800">
                    {p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{p.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function ReportCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      <p className="font-medium text-zinc-900">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </Link>
  );
}
