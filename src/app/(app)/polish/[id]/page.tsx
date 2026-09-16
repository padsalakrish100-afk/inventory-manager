import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditPolishedStoneForm } from "./edit-form";
import { BarcodeLabel, PrintLabelButton } from "@/components/barcode-label";

export default async function PolishedStoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const polished = await prisma.polishedStone.findUnique({
    where: { id },
    include: {
      sourceProduct: {
        include: {
          lot: { include: { sourceParty: true } },
          movements: { include: { party: true }, orderBy: { issueDate: "asc" } },
        },
      },
    },
  });
  if (!polished) notFound();

  const source = polished.sourceProduct;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Stock {polished.stockId}</h1>
          <p className="mt-1 text-sm text-zinc-500">Finished stone, ready for sale.</p>
        </div>
        <div className="flex items-center gap-4">
          <BarcodeLabel sku={polished.stockId} name={polished.shape ?? "Polished stone"} caratWeight={polished.caratWeight} />
          <PrintLabelButton />
        </div>
      </div>

      <EditPolishedStoneForm
        id={polished.id}
        defaults={{
          certified: polished.certified,
          certLab: polished.certLab,
          certNumber: polished.certNumber,
          shape: polished.shape,
          caratWeight: polished.caratWeight,
          color: polished.color,
          clarity: polished.clarity,
          cutGrade: polished.cutGrade,
          polishGrade: polished.polishGrade,
          symmetry: polished.symmetry,
          fluorescence: polished.fluorescence,
          measurements: polished.measurements,
          notes: polished.notes,
        }}
      />

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">History &amp; traceability</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Manufacturing stone number</dt>
              <dd className="mt-0.5">
                <Link href={`/manufacturing/stone/${source.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                  {source.sku}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Lot</dt>
              <dd className="mt-0.5">
                {source.lot ? (
                  <Link href={`/lotting/${source.lot.id}`} className="font-medium text-zinc-900 hover:underline">
                    {source.lot.lotNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Rough sourced from</dt>
              <dd className="mt-0.5 text-zinc-900">{source.lot?.sourceParty?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Processes gone through</dt>
              <dd className="mt-0.5 text-zinc-900">{source.movements.length}</dd>
            </div>
          </dl>

          {source.movements.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="py-2 font-medium">Process</th>
                    <th className="py-2 font-medium">Party</th>
                    <th className="py-2 font-medium">Issued</th>
                    <th className="py-2 font-medium">Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {source.movements.map((m) => (
                    <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 text-zinc-800">{m.process}</td>
                      <td className="py-2 text-zinc-500">{m.party?.name ?? "—"}</td>
                      <td className="py-2 text-zinc-500">{m.issueDate.toLocaleDateString()}</td>
                      <td className="py-2 text-zinc-500">
                        {m.returnDate ? m.returnDate.toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
