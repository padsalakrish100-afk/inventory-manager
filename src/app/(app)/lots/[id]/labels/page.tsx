import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BarcodeLabel, PrintLabelButton } from "../../../products/[id]/barcode-label";

export default async function LotLabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: { products: { orderBy: { sku: "asc" } } },
  });
  if (!lot) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Print labels — Lot {lot.lotNumber}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            One barcode label per SKU in this lot ({lot.products.length} total). Each scans back to
            that stone's page.
          </p>
        </div>
        <PrintLabelButton />
      </div>

      {lot.products.length === 0 ? (
        <p className="text-sm text-zinc-500">No SKUs linked to this lot yet.</p>
      ) : (
        <div className="print-labels flex flex-wrap gap-3">
          {lot.products.map((p) => (
            <BarcodeLabel key={p.id} sku={p.sku} name={p.name} caratWeight={p.caratWeight} />
          ))}
        </div>
      )}
    </div>
  );
}
