import { num } from "@/lib/decimal";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatMoney } from "@/lib/format";

// After polishing: what the planner expected vs what came out — weight,
// yield (polished ÷ rough) and value.
export default async function PlannedVsActualPage() {
  await requirePagePermission("mfg.reports");

  const stones = await prisma.product.findMany({
    where: { polishedStone: { isNot: null }, plans: { some: { isFinal: true } } },
    select: {
      id: true,
      sku: true,
      roughWeight: true,
      plans: { where: { isFinal: true }, take: 1 },
      polishedStone: { select: { stockId: true, caratWeight: true, color: true, clarity: true, askingPrice: true, soldPrice: true, currency: true } },
    },
    orderBy: { sku: "asc" },
    take: 1000,
  });

  const rows = stones.map((s) => {
    const plan = s.plans[0];
    const rough = s.roughWeight !== null ? Number(s.roughWeight) : null;
    const planned = Number(plan.plannedWeight);
    const actual = num(s.polishedStone?.caratWeight);
    const actualValue = s.polishedStone?.soldPrice ?? s.polishedStone?.askingPrice ?? null;
    return { s, plan, rough, planned, actual, actualValue };
  });
  const totals = rows.reduce(
    (t, r) => ({
      rough: t.rough + (r.rough ?? 0),
      planned: t.planned + r.planned,
      actual: t.actual + (r.actual ?? 0),
    }),
    { rough: 0, planned: 0, actual: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Planned vs actual</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Polished stones with a final plan. Yield = polished weight ÷ rough weight. Actual value is the sold price, or
          the asking price if unsold.
        </p>
        <Link href="/planning" className="text-sm text-zinc-500 hover:underline">
          &larr; Planning
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Stones" value={String(rows.length)} />
          <Stat label="Planned yield" value={totals.rough ? `${((totals.planned / totals.rough) * 100).toFixed(1)}%` : "—"} />
          <Stat label="Actual yield" value={totals.rough ? `${((totals.actual / totals.rough) * 100).toFixed(1)}%` : "—"} />
          <Stat label="Weight vs plan" value={totals.planned ? `${(((totals.actual - totals.planned) / totals.planned) * 100).toFixed(1)}%` : "—"} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Stone</th>
              <th className="px-4 py-2 font-medium text-right">Rough</th>
              <th className="px-4 py-2 font-medium text-right">Planned</th>
              <th className="px-4 py-2 font-medium text-right">Actual</th>
              <th className="px-4 py-2 font-medium text-right">Yield plan → actual</th>
              <th className="px-4 py-2 font-medium">Grade plan → actual</th>
              <th className="px-4 py-2 font-medium text-right">Value plan → actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No polished stones with a plan yet.
                </td>
              </tr>
            )}
            {rows.map(({ s, plan, rough, planned, actual, actualValue }) => {
              const short = actual !== null && actual < planned;
              return (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/stones/${s.id}`} className="font-mono text-xs hover:underline">
                      {s.sku}
                    </Link>
                    <span className="block text-xs text-zinc-500">{s.polishedStone?.stockId}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{rough ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{planned.toFixed(3)}</td>
                  <td className={`px-4 py-2 text-right ${short ? "text-red-700" : "text-emerald-700"}`}>{actual?.toFixed(3) ?? "—"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {rough ? `${((planned / rough) * 100).toFixed(1)}% → ${actual !== null ? ((actual / rough) * 100).toFixed(1) + "%" : "—"}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {[plan.expColor, plan.expClarity].filter(Boolean).join(" ") || "—"} →{" "}
                    {[s.polishedStone?.color, s.polishedStone?.clarity].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {plan.expectedValue !== null ? formatMoney(Number(plan.expectedValue), plan.currency) : "—"} →{" "}
                    {actualValue !== null ? formatMoney(actualValue, s.polishedStone!.currency) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
