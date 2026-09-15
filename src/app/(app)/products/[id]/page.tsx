import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/stages";
import { updateProduct, deleteProcessLog } from "../actions";
import { ProductForm } from "../product-form";
import { ProcessLogForm } from "./process-log-form";
import { BarcodeLabel, PrintLabelButton } from "./barcode-label";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, lots, settings, parties] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { processLogs: { include: { party: true }, orderBy: { date: "asc" } } },
    }),
    prisma.lot.findMany({ orderBy: { lotNumber: "asc" } }),
    getSettings(),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  const boundAction = updateProduct.bind(null, product.id);
  const boundDeleteLog = deleteProcessLog.bind(null, product.id);

  const processCounts = new Map<string, number>();
  for (const log of product.processLogs) {
    processCounts.set(log.stage, (processCounts.get(log.stage) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Edit product</h1>
          <p className="mt-1 text-sm text-zinc-500">{product.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <BarcodeLabel sku={product.sku} name={product.name} caratWeight={product.caratWeight} />
          <PrintLabelButton />
        </div>
      </div>
      <ProductForm
        action={boundAction}
        submitLabel="Save changes"
        lots={lots.map((l) => ({ id: l.id, lotNumber: l.lotNumber }))}
        locationSuggestions={settings.locations}
        defaultValues={{
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          stock: product.stock,
          reorderLevel: product.reorderLevel,
          location: product.location,
          certificationLab: product.certificationLab,
          caratWeight: product.caratWeight,
          color: product.color,
          clarity: product.clarity,
          cutGrade: product.cutGrade,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          lotId: product.lotId,
          stage: product.stage,
        }}
      />

      <section className="flex max-w-2xl flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Process log</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Every step this stone has gone through — Galaxy scanning, sawing, cutting,
            polishing, certification — and which party did it. Adding a step here also
            moves the SKU's current stage above.
          </p>
        </div>

        {processCounts.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...processCounts.entries()].map(([stage, count]) => (
              <span
                key={stage}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STAGE_STYLES[stage]}`}
              >
                {STAGE_LABELS[stage] ?? stage} × {count}
                {count > 1 ? " (reworked)" : ""}
              </span>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {product.processLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No process steps recorded yet.
                  </td>
                </tr>
              )}
              {product.processLogs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-500">{log.date.toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[log.stage]}`}>
                      {STAGE_LABELS[log.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{log.party?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{log.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={boundDeleteLog.bind(null, log.id)}>
                      <button type="submit" className="text-zinc-400 hover:text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ProcessLogForm productId={product.id} partyNames={parties.map((p) => p.name)} />
      </section>
    </div>
  );
}
