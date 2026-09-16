import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS, PROCESS_STYLES } from "@/lib/process";

export default async function ManufacturingReportsPage() {
  const [lots, stones] = await Promise.all([
    prisma.lot.findMany({
      include: {
        sourceParty: true,
        products: { include: { polishedStone: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      include: {
        lot: true,
        currentParty: true,
        polishedStone: true,
        movements: true,
      },
      orderBy: { sku: "asc" },
    }),
  ]);

  const stoneRows = stones.map((s) => {
    const counts = new Map<string, number>();
    for (const m of s.movements) counts.set(m.process, (counts.get(m.process) ?? 0) + 1);
    const totalMoves = s.movements.length;
    const reworked = [...counts.values()].some((c) => c > 1);
    return { stone: s, counts, totalMoves, reworked };
  });

  const reworkedCount = stoneRows.filter((r) => r.reworked).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Manufacturing reports</h1>
        <p className="mt-1 text-sm text-zinc-500">Whole-lot summary and every stone's own detail.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">By lot</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Lot</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Rough weight</th>
                <th className="px-4 py-3 font-medium">Stones</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">In Polish</th>
              </tr>
            </thead>
            <tbody>
              {lots.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    No lots yet.
                  </td>
                </tr>
              )}
              {lots.map((lot) => {
                const polished = lot.products.filter((p) => p.polishedStone).length;
                const issued = lot.products.filter((p) => p.currentProcess && !p.polishedStone).length;
                const available = lot.products.length - polished - issued;
                return (
                  <tr key={lot.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/lotting/${lot.id}`} className="font-medium text-zinc-900 hover:underline">
                        {lot.lotNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{lot.sourceParty?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{lot.roughWeight ?? "—"} ct</td>
                    <td className="px-4 py-3 text-zinc-800">{lot.products.length}</td>
                    <td className="px-4 py-3 text-zinc-500">{available}</td>
                    <td className="px-4 py-3 text-zinc-500">{issued}</td>
                    <td className="px-4 py-3 text-zinc-500">{polished}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Every stone</h2>
          <span className="text-sm text-zinc-500">
            {reworkedCount} of {stoneRows.length} reworked (sent through the same process more than once)
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Stone</th>
                <th className="px-4 py-3 font-medium">Lot</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Times processed</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stoneRows.map(({ stone, counts, totalMoves, reworked }) => (
                <tr key={stone.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{stone.sku}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {stone.lot ? (
                      <Link href={`/lotting/${stone.lot.id}`} className="hover:underline">
                        {stone.lot.lotNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {stone.polishedStone ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Polished
                      </span>
                    ) : stone.currentProcess ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCESS_STYLES[stone.currentProcess]}`}>
                        {PROCESS_LABELS[stone.currentProcess]}
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        Available
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {totalMoves === 0 ? (
                      "—"
                    ) : (
                      <span className={reworked ? "font-medium text-orange-600" : ""}>
                        {[...counts.entries()].map(([p, c]) => `${PROCESS_LABELS[p]} ×${c}`).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/manufacturing/stone/${stone.id}`} className="text-zinc-600 hover:underline">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
