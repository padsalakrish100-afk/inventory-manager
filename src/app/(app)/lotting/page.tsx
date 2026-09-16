import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ExportButtons } from "@/components/export-buttons";

export default async function LottingPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
    include: { sourceParty: true, _count: { select: { products: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lotting</h1>
          <p className="mt-1 text-sm text-zinc-500">Rough batches, numbered as soon as they come in.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons report="lotting" />
          <Link
            href="/lotting/new"
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
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Rough weight</th>
              <th className="px-4 py-3 font-medium">Purchase cost</th>
              <th className="px-4 py-3 font-medium">Stones</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No lots yet.{" "}
                  <Link href="/lotting/new" className="underline">
                    Log the first one
                  </Link>
                  .
                </td>
              </tr>
            )}
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/lotting/${lot.id}`} className="font-medium text-zinc-900 hover:underline">
                    {lot.lotNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{lot.sourceParty?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{lot.roughWeight ?? "—"} ct</td>
                <td className="px-4 py-3 text-zinc-500">
                  {lot.purchaseCost !== null ? (
                    <>
                      {lot.purchaseCost.toLocaleString()}
                      {lot.roughWeight ? (
                        <span className="text-zinc-400"> (≈ {(lot.purchaseCost / lot.roughWeight).toFixed(2)}/ct)</span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-800">{lot._count.products}</td>
                <td className="px-4 py-3 text-zinc-500">{lot.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
