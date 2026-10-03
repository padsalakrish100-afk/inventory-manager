import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { usdInrOn } from "@/lib/fx";
import { formatInr, formatUsd } from "@/lib/money";
import { inventoryValuation, VALUED_STATUSES } from "@/lib/costing/valuation";
import { STONE_LOCATION_LABELS, STONE_LOCATION_VALUES, STONE_STATUS_LABELS, type StoneLocationValue, type StoneStatusValue } from "@/lib/stone/status";

export default async function CostingPage({ searchParams }: { searchParams: Promise<{ status?: string; location?: string }> }) {
  await requirePagePermission("costs.view");
  const sp = await searchParams;
  const status = (VALUED_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const location = (STONE_LOCATION_VALUES as readonly string[]).includes(sp.location ?? "") ? sp.location : undefined;

  const fx = await usdInrOn(prisma, new Date());
  const rows = await inventoryValuation({ status, location }, fx ? Number(fx) : null);
  const total = rows.reduce(
    (t, r) => ({
      stones: t.stones + r.stones,
      carats: t.carats + r.carats,
      costUsd: t.costUsd + r.costUsd,
      costInr: t.costInr + r.costInr,
      askingUsd: t.askingUsd + r.askingUsd,
      askingInr: t.askingInr + r.askingInr,
      pricedCostUsd: t.pricedCostUsd + r.pricedCostUsd,
      unpriced: t.unpriced + r.unpriced,
    }),
    { stones: 0, carats: 0, costUsd: 0, costInr: 0, askingUsd: 0, askingInr: 0, pricedCostUsd: 0, unpriced: 0 },
  );
  const selectClass = "mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Costing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live inventory value at cost and at asking price. Cost = rough + labour + job-work + certification + other +
            overhead, from each stone&apos;s ledger.
          </p>
        </div>
        <Link href="/costing/overhead" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Monthly overhead
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs font-medium text-zinc-500">
          Status
          <select name="status" defaultValue={status ?? ""} className={selectClass}>
            <option value="">All in inventory</option>
            {VALUED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STONE_STATUS_LABELS[s as StoneStatusValue]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Location
          <select name="location" defaultValue={location ?? ""} className={selectClass}>
            <option value="">All</option>
            {STONE_LOCATION_VALUES.map((l) => (
              <option key={l} value={l}>
                {STONE_LOCATION_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50">
          Show
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stones" value={total.stones.toLocaleString("en-IN")} sub={`${total.carats.toFixed(3)} ct`} />
        <Stat label="At cost" value={formatUsd(total.costUsd)} sub={formatInr(total.costInr)} />
        <Stat label="At asking" value={formatUsd(total.askingUsd)} sub={`${formatInr(total.askingInr)} · ${total.unpriced} unpriced`} />
        <Stat
          label="Asking over cost"
          value={
            total.pricedCostUsd > 0 && total.askingUsd > 0
              ? `${(((total.askingUsd - total.pricedCostUsd) / total.pricedCostUsd) * 100).toFixed(1)}%`
              : "—"
          }
          sub="priced stones vs their cost"
        />
      </div>
      {!fx && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No exchange rate entered — asking prices aren&apos;t converted between USD and INR.{" "}
          <Link href="/settings/fx" className="underline">
            Add today&apos;s rate
          </Link>
          .
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium text-right">Stones</th>
              <th className="px-4 py-2 font-medium text-right">Carats</th>
              <th className="px-4 py-2 font-medium text-right">Cost USD</th>
              <th className="px-4 py-2 font-medium text-right">Cost INR</th>
              <th className="px-4 py-2 font-medium text-right">Asking USD</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  Nothing in inventory.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.status}-${r.location}`} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/stones?status=${r.status}&location=${r.location}`} className="hover:underline">
                    {STONE_STATUS_LABELS[r.status as StoneStatusValue] ?? r.status}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{STONE_LOCATION_LABELS[r.location as StoneLocationValue] ?? r.location}</td>
                <td className="px-4 py-2 text-right">{r.stones}</td>
                <td className="px-4 py-2 text-right">{r.carats.toFixed(3)}</td>
                <td className="px-4 py-2 text-right">{formatUsd(r.costUsd)}</td>
                <td className="px-4 py-2 text-right">{formatInr(r.costInr)}</td>
                <td className="px-4 py-2 text-right">{r.askingUsd ? formatUsd(r.askingUsd) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Cost lines without an exchange rate (entered before rates existed) count only in their own currency&apos;s total.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
