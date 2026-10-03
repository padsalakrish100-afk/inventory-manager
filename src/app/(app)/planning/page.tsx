import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { CUT_STYLE_LABELS } from "@/lib/cuts";

const PAGE_SIZE = 100;

// Stones in production and their plans — unplanned ones first.
export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ show?: string; lot?: string; page?: string }> }) {
  const viewer = await requirePagePermission("mfg.view");
  const sp = await searchParams;
  const show = sp.show === "planned" ? "planned" : sp.show === "all" ? "all" : "unplanned";
  const page = Math.max(1, Number(sp.page) || 1);

  const lots = await prisma.lot.findMany({
    where: { products: { some: { status: "IN_PRODUCTION" } } },
    select: { id: true, lotNumber: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const where = {
    status: "IN_PRODUCTION" as const,
    deletedAt: null,
    ...(sp.lot ? { lotId: sp.lot } : {}),
    ...(show === "unplanned" ? { plans: { none: { isFinal: true } } } : show === "planned" ? { plans: { some: { isFinal: true } } } : {}),
  };
  const [stones, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        roughWeight: true,
        caratWeight: true,
        currentStage: { select: { name: true } },
        plans: { where: { isFinal: true }, take: 1 },
      },
      orderBy: { sku: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tab = (value: string, label: string) => (
    <Link
      href={`/planning?show=${value}${sp.lot ? `&lot=${sp.lot}` : ""}`}
      className={`min-h-10 rounded-md border px-3 py-2 text-sm ${show === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Planning</h1>
          <p className="mt-1 text-sm text-zinc-500">Planned shape, weight, grade and value for each stone in production.</p>
        </div>
        {can(viewer, "mfg.reports") && (
          <Link href="/planning/report" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Planned vs actual
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tab("unplanned", "Needs a plan")}
        {tab("planned", "Planned")}
        {tab("all", "All")}
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="show" value={show} />
          <select name="lot" defaultValue={sp.lot ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">All lots</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lotNumber}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
            Go
          </button>
        </form>
      </div>

      <p className="text-sm text-zinc-500">{total} stone{total === 1 ? "" : "s"}</p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Stone</th>
              <th className="px-4 py-2 font-medium text-right">Rough</th>
              <th className="px-4 py-2 font-medium">Final plan</th>
              <th className="px-4 py-2 font-medium">At</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {stones.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Nothing here.
                </td>
              </tr>
            )}
            {stones.map((s) => {
              const plan = s.plans[0];
              const rough = s.roughWeight !== null ? Number(s.roughWeight) : s.caratWeight;
              return (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/stones/${s.id}`} className="font-mono text-xs font-medium hover:underline">
                      {s.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{rough ?? "—"} ct</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {plan
                      ? `${plan.plannedShape}${plan.plannedCutStyle ? ` · ${CUT_STYLE_LABELS[plan.plannedCutStyle] ?? ""}` : ""} · ${Number(plan.plannedWeight)} ct${rough ? ` (${((Number(plan.plannedWeight) / rough) * 100).toFixed(0)}%)` : ""}`
                      : <span className="text-amber-700">No plan</span>}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{s.currentStage?.name ?? "In hand"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/stones/${s.id}/plan`} className="min-h-10 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
                      {plan ? "Open" : "Plan"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-between text-sm">
          {page > 1 ? <Link href={`/planning?show=${show}&page=${page - 1}${sp.lot ? `&lot=${sp.lot}` : ""}`}>&larr; Previous</Link> : <span />}
          {page < pages && <Link href={`/planning?show=${show}&page=${page + 1}${sp.lot ? `&lot=${sp.lot}` : ""}`}>Next &rarr;</Link>}
        </div>
      )}
    </div>
  );
}
