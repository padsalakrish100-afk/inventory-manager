import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS, PROCESS_STYLES } from "@/lib/process";

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
        <div className="flex flex-wrap gap-2">
          {[...processCounts.entries()].map(([process, count]) => (
            <span
              key={process}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${PROCESS_STYLES[process]}`}
            >
              {PROCESS_LABELS[process] ?? process} × {count}
              {count > 1 ? " (reworked)" : ""}
            </span>
          ))}
        </div>
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
                <th className="px-4 py-3 font-medium">Returned</th>
                <th className="px-4 py-3 font-medium">Return wt.</th>
              </tr>
            </thead>
            <tbody>
              {stone.movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
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
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{m.party?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.issueDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-zinc-500">{m.issueWeight ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {m.returnDate ? m.returnDate.toLocaleDateString() : "Not returned yet"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{m.returnWeight ?? "—"}</td>
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
