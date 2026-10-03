import Link from "next/link";
import { can, requirePagePermission } from "@/lib/authz";
import { todayIST } from "@/lib/dates";
import { karigarPerformance } from "@/lib/karigar/performance";
import { formatInrCents, periodBounds } from "@/lib/karigar/payroll";
import { ExportButtons } from "@/components/export-buttons";

function isDate(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

// Work completed per karigar in a period: pieces, carats, loss, excess-loss
// returns, and breakage they were handling.
export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const viewer = await requirePagePermission("karigars.manage");
  const showCosts = can(viewer, "costs.view");
  const sp = await searchParams;
  const today = todayIST();
  const from = isDate(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = isDate(sp.to) ? sp.to : today;
  const { start, end } = periodBounds(from, to);
  const lines = await karigarPerformance(start, end);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Karigar performance</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Returns completed in the period. Average loss is total carats lost ÷ total carats issued.
          </p>
          <Link href="/karigars" className="text-sm text-zinc-500 hover:underline">
            &larr; Karigars
          </Link>
        </div>
        <ExportButtons report="karigar-performance" params={new URLSearchParams({ from, to })} />
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs font-medium text-zinc-500">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          To
          <input type="date" name="to" defaultValue={to} className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Show
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Karigar</th>
              <th className="px-4 py-2 font-medium text-right">Returns</th>
              <th className="px-4 py-2 font-medium text-right">Pieces</th>
              <th className="px-4 py-2 font-medium text-right">Carats</th>
              <th className="px-4 py-2 font-medium text-right">Avg loss</th>
              <th className="px-4 py-2 font-medium text-right">Excess loss</th>
              <th className="px-4 py-2 font-medium text-right">Breakage</th>
              <th className="px-4 py-2 font-medium text-right">In hand now</th>
              {showCosts && <th className="px-4 py-2 font-medium text-right">Labour</th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={showCosts ? 9 : 8} className="px-4 py-6 text-center text-zinc-500">
                  No returns in this period.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.partyId} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/karigars/${l.partyId}`} className="font-medium text-zinc-900 hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">{l.returns}</td>
                <td className="px-4 py-2 text-right">{l.pieces}</td>
                <td className="px-4 py-2 text-right">{l.caratsIssued.toFixed(3)}</td>
                <td className="px-4 py-2 text-right">{l.avgLossPct !== null ? `${l.avgLossPct.toFixed(2)}%` : "—"}</td>
                <td className={`px-4 py-2 text-right ${l.excessCount ? "font-semibold text-red-700" : ""}`}>{l.excessCount}</td>
                <td className={`px-4 py-2 text-right ${l.breakageCount ? "font-semibold text-red-700" : ""}`}>{l.breakageCount}</td>
                <td className="px-4 py-2 text-right">{l.pendingNow}</td>
                {showCosts && <td className="px-4 py-2 text-right">{formatInrCents(Math.round(l.labourInr * 100))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
