import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POLISH_STATUS_OPTIONS, POLISH_STATUS_LABELS } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";

export default async function InventoryValueReportPage() {
  const stones = await prisma.polishedStone.findMany();

  const rows = POLISH_STATUS_OPTIONS.map((s) => {
    const stonesInStatus = stones.filter((p) => p.status === s.value);
    const totals = new Map<string, number>();
    for (const p of stonesInStatus) {
      const value = s.value === "SOLD" ? p.soldPrice : p.askingPrice;
      if (value === null) continue;
      totals.set(p.currency, (totals.get(p.currency) ?? 0) + value);
    }
    return { status: s.value, label: s.label, count: stonesInStatus.length, totals };
  });

  const grandCount = stones.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Inventory value summary</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Total value by status — asking price for unsold stones, sold price for sold ones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons report="polish-inventory-value" />
          <Link href="/polish/summary" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Back to summary
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Stones</th>
              <th className="px-4 py-3 font-medium">Value basis</th>
              <th className="px-4 py-3 font-medium">Total value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{POLISH_STATUS_LABELS[r.status]}</td>
                <td className="px-4 py-3 text-zinc-800">{r.count}</td>
                <td className="px-4 py-3 text-zinc-500">{r.status === "SOLD" ? "Sold price" : "Asking price"}</td>
                <td className="px-4 py-3 text-zinc-800">
                  {r.totals.size === 0
                    ? "—"
                    : [...r.totals.entries()].map(([currency, total]) => formatMoney(total, currency)).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td colSpan={2} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {grandCount} stone{grandCount === 1 ? "" : "s"} total
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
