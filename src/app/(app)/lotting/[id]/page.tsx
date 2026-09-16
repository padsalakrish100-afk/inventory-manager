import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS, PROCESS_STYLES } from "@/lib/process";
import { DeleteLotButton } from "./delete-lot-button";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      sourceParty: true,
      products: {
        orderBy: { sku: "asc" },
        include: { currentParty: true, polishedStone: true },
      },
    },
  });
  if (!lot) notFound();

  const availableCount = lot.products.filter((p) => !p.currentProcess && !p.polishedStone).length;
  const polishedCount = lot.products.filter((p) => p.polishedStone).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lot {lot.lotNumber}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Source: {lot.sourceParty?.name ?? "—"} &middot; Rough weight: {lot.roughWeight ?? "—"} ct &middot;{" "}
            {lot.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lot.products.length > 0 && (
            <Link
              href={`/lotting/${lot.id}/labels`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Print labels
            </Link>
          )}
          <DeleteLotButton lotId={lot.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total stones" value={String(lot.products.length)} />
        <StatCard label="Available (not issued)" value={String(availableCount)} />
        <StatCard label="Transferred to Polish" value={String(polishedCount)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stone number</th>
              <th className="px-4 py-3 font-medium">Weight</th>
              <th className="px-4 py-3 font-medium">Current location</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lot.products.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.polishedStone ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Polish ({p.polishedStone.stockId})
                    </span>
                  ) : p.currentProcess ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCESS_STYLES[p.currentProcess]}`}>
                      {PROCESS_LABELS[p.currentProcess]}
                      {p.currentParty ? ` · ${p.currentParty.name}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      Available
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manufacturing/stone/${p.id}`} className="text-zinc-600 hover:underline">
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
