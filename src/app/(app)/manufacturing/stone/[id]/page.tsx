import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS, PROCESS_STYLES, PROCESS_OPTIONS } from "@/lib/process";
import { UndoMovementButton } from "./undo-movement-button";
import { DeleteStoneButton } from "./delete-stone-button";

export default async function StoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stone = await prisma.product.findUnique({
    where: { id },
    include: {
      lot: { include: { sourceParty: true } },
      currentParty: true,
      polishedStone: true,
      movements: {
        include: { party: true },
        orderBy: { issueDate: "desc" },
      },
    },
  });
  if (!stone) notFound();

  const processCounts = new Map<string, number>();
  for (const m of stone.movements) {
    processCounts.set(m.process, (processCounts.get(m.process) ?? 0) + 1);
  }

  const canTransfer = !stone.currentProcess && !stone.polishedStone;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Stone {stone.sku}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {stone.lot ? (
              <>
                From lot{" "}
                <Link href={`/lotting/${stone.lot.id}`} className="underline">
                  {stone.lot.lotNumber}
                </Link>
                {stone.lot.sourceParty ? ` · sourced from ${stone.lot.sourceParty.name}` : ""}
              </>
            ) : (
              "Not linked to a lot"
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stone.polishedStone ? (
            <Link
              href={`/polish/${stone.polishedStone.id}`}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              View in Polish ({stone.polishedStone.stockId})
            </Link>
          ) : canTransfer ? (
            <Link
              href={`/manufacturing/stone/${stone.id}/transfer`}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              Transfer to Polish
            </Link>
          ) : (
            <span className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
              Return it first to transfer
            </span>
          )}
          {stone.movements.length === 0 && !stone.polishedStone && (
            <DeleteStoneButton productId={stone.id} lotId={stone.lotId} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Weight" value={stone.caratWeight ? `${stone.caratWeight} ct` : "—"} />
        <StatCard
          label="Current location"
          value={stone.currentProcess ? PROCESS_LABELS[stone.currentProcess] : "Available"}
        />
        <StatCard label="Current party" value={stone.currentParty?.name ?? "—"} />
      </div>

      {processCounts.size > 0 && (
        <p className="text-sm text-zinc-700">
          {PROCESS_OPTIONS.filter((p) => processCounts.has(p.value))
            .map((p) => {
              const count = processCounts.get(p.value)!;
              return (
                <span key={p.value} className={count > 1 ? "font-medium text-orange-600" : ""}>
                  {p.label}: {count}×
                </span>
              );
            })
            .reduce((acc, el, i) => (i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-zinc-300"> · </span>, el]), [] as ReactNode[])}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Movement history</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Process</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Issue wt.</th>
                <th className="px-4 py-3 font-medium">Labor cost</th>
                <th className="px-4 py-3 font-medium">Returned</th>
                <th className="px-4 py-3 font-medium">Return wt.</th>
                <th className="px-4 py-3 font-medium">Tops wt.</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stone.movements.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                    Never issued yet.
                  </td>
                </tr>
              )}
              {stone.movements.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCESS_STYLES[m.process]}`}>
                      {PROCESS_LABELS[m.process]}
                    </span>
                    {m.reissueReason && (
                      <p className="mt-1 max-w-[16rem] text-xs italic text-amber-700">Reissue: {m.reissueReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{m.party?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.issueDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.issueWeight ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.laborCost !== null ? `₹${m.laborCost.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {m.returnDate ? m.returnDate.toLocaleDateString() : "Not returned yet"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{m.returnWeight ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.topsWeight ?? "—"}</td>
                  <td className="px-4 py-3">
                    <UndoMovementButton movementId={m.id} productId={stone.id} />
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
