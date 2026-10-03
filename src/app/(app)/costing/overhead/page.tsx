import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { OverheadForm, PoolButtons } from "./controls";

export default async function OverheadPage() {
  const viewer = await requirePagePermission("costs.view");
  const pools = await prisma.overheadPool.findMany({ orderBy: { month: "desc" }, take: 36 });
  const counts = await prisma.costEntry.groupBy({
    by: ["sourceId"],
    where: { sourceType: "OVERHEAD_POOL", voidedAt: null, sourceId: { in: pools.map((p) => p.id) } },
    _count: true,
  });
  const countBy = new Map(counts.map((c) => [c.sourceId, c._count]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Monthly overhead</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Factory costs that aren&apos;t piece-rate labour. Each month&apos;s amount is spread over the stones returned that
          month, by carats issued (or equally, per Settings). Re-spread after late returns are entered.
        </p>
        <Link href="/costing" className="text-sm text-zinc-500 hover:underline">
          &larr; Costing
        </Link>
      </div>
      <OverheadForm />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Month</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2 font-medium">Spread over</th>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pools.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No overhead entered yet.
                </td>
              </tr>
            )}
            {pools.map((p) => (
              <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                <td className="px-4 py-2">{p.month.toISOString().slice(0, 7)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatMoney(Number(p.amount), p.currency)}</td>
                <td className="px-4 py-2 text-zinc-600">
                  {countBy.get(p.id) ?? 0} stones{p.allocatedAt ? ` · ${formatDate(p.allocatedAt)}` : ""}
                </td>
                <td className="px-4 py-2 text-zinc-600">{p.note ?? "—"}</td>
                <td className="px-4 py-2 text-right">{!p.voidedAt && <PoolButtons poolId={p.id} canVoid={can(viewer, "admin")} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
