import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROCESS_OPTIONS, PROCESS_STYLES } from "@/lib/process";
import { StoneLookupForm } from "./stone-lookup-form";

export default async function ManufacturingPage() {
  const stonesOut = await prisma.product.findMany({
    where: { currentProcess: { not: null } },
    include: { currentParty: true, lot: true },
    orderBy: { sku: "asc" },
  });

  const byProcess = new Map<string, typeof stonesOut>();
  for (const p of PROCESS_OPTIONS) byProcess.set(p.value, []);
  for (const stone of stonesOut) {
    if (stone.currentProcess) byProcess.get(stone.currentProcess)?.push(stone);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Manufacturing</h1>
          <p className="mt-1 text-sm text-zinc-500">Where every issued stone is right now.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/manufacturing/issue"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            Issue to process
          </Link>
          <Link
            href="/manufacturing/return"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Return from process
          </Link>
          <Link
            href="/manufacturing/reports"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Reports
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">Look up a stone</h2>
        <p className="mt-1 text-sm text-zinc-500">Scan or type a stone number to jump straight to it.</p>
        <div className="mt-3">
          <StoneLookupForm />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROCESS_OPTIONS.map((p) => {
          const stones = byProcess.get(p.value) ?? [];
          return (
            <div key={p.value} className="rounded-lg border border-zinc-200 bg-white p-4">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PROCESS_STYLES[p.value]}`}>
                {p.label}
              </span>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{stones.length}</p>
              <p className="text-xs text-zinc-500">stone{stones.length === 1 ? "" : "s"} out</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stone number</th>
              <th className="px-4 py-3 font-medium">Lot</th>
              <th className="px-4 py-3 font-medium">Process</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Weight</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {stonesOut.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  Nothing currently issued.
                </td>
              </tr>
            )}
            {stonesOut.map((stone) => (
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCESS_STYLES[stone.currentProcess!]}`}>
                    {PROCESS_OPTIONS.find((p) => p.value === stone.currentProcess)?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-800">{stone.currentParty?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{stone.caratWeight ?? "—"}</td>
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
    </div>
  );
}
