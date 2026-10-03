import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditPolishedStoneForm } from "./edit-form";
import { SaleForm } from "./sale-form";
import { BarcodeLabel, PrintLabelButton } from "@/components/barcode-label";
import { UndoTransferButton } from "./undo-transfer-button";
import { POLISH_STATUS_LABELS, POLISH_STATUS_STYLES } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { stoneCosts } from "@/lib/costing/ledger";
import { formatInr, formatUsd } from "@/lib/money";

export default async function PolishedStoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("stock.view");
  const canEdit = can(viewer, "stock.edit");
  const showCosts = can(viewer, "costs.view");
  const { id } = await params;
  const [polished, parties] = await Promise.all([
    prisma.polishedStone.findUnique({
      where: { id },
      include: {
        buyer: true,
        sourceProduct: {
          include: {
            lot: { include: { sourceParty: true } },
            movements: {
              where: { voidedAt: null },
              include: { party: true, stage: { select: { name: true } } },
              orderBy: { issueDate: "asc" },
            },
          },
        },
      },
    }),
    prisma.party.findMany({
      where: { roles: { has: "CUSTOMER" }, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!polished) notFound();

  const source = polished.sourceProduct;

  // Cost and margin from the stone's ledger, in the sale currency.
  const cost = showCosts ? (await stoneCosts(prisma, [source.id])).get(source.id)! : null;
  const costInSaleCurrency = cost ? (polished.currency === "INR" ? cost.inrCents : cost.usdCents) / 100 : null;
  const margin = costInSaleCurrency !== null && polished.soldPrice !== null ? polished.soldPrice - costInSaleCurrency : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">Stock {polished.stockId}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${POLISH_STATUS_STYLES[polished.status]}`}>
              {POLISH_STATUS_LABELS[polished.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">Finished stone, ready for sale.</p>
        </div>
        <div className="flex items-center gap-4">
          <BarcodeLabel sku={polished.stockId} name={polished.shape ?? "Polished stone"} caratWeight={polished.caratWeight} />
          <PrintLabelButton />
          {can(viewer, "stones.edit") && <UndoTransferButton polishedStoneId={polished.id} />}
        </div>
      </div>

      {/* A disabled fieldset makes every field and button inside read-only
          for people who may view stock but not change it. */}
      <fieldset disabled={!canEdit} className="contents">
      <EditPolishedStoneForm
        id={polished.id}
        defaults={{
          certified: polished.certified,
          certLab: polished.certLab,
          certNumber: polished.certNumber,
          saleType: polished.saleType,
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

      <section className="flex max-w-2xl flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">{showCosts ? "Sales & cost" : "Sales"}</h2>
        <SaleForm
          id={polished.id}
          buyerNames={parties.map((p) => p.name)}
          defaults={{
            status: polished.status,
            location: polished.location,
            askingPrice: polished.askingPrice,
            currency: polished.currency,
            buyerName: polished.buyer?.name ?? null,
            soldPrice: polished.soldPrice,
            soldDate: polished.soldDate ? polished.soldDate.toISOString().slice(0, 10) : null,
            paymentStatus: polished.paymentStatus,
          }}
        />
      </section>
      {cost && (
        <section className="flex max-w-2xl flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="font-medium text-zinc-900">Cost &amp; margin</h2>
          <p className="text-sm text-zinc-600">
            Total cost: <span className="font-medium text-zinc-900">{formatUsd(cost.usdCents / 100)}</span> ·{" "}
            {formatInr(cost.inrCents / 100)}
            {polished.caratWeight ? ` · ${formatUsd(cost.usdCents / 100 / polished.caratWeight)}/ct` : ""}
          </p>
          {polished.askingPrice !== null && costInSaleCurrency !== null && costInSaleCurrency > 0 && (
            <p className="text-sm text-zinc-600">
              Asking is {(((polished.askingPrice - costInSaleCurrency) / costInSaleCurrency) * 100).toFixed(1)}% over cost.
            </p>
          )}
          {margin !== null && (
            <p className={`text-sm font-medium ${margin < 0 ? "text-red-700" : "text-emerald-700"}`}>
              Profit on sale: {formatMoney(margin, polished.currency)} (
              {costInSaleCurrency ? ((margin / costInSaleCurrency) * 100).toFixed(1) : "—"}% on cost)
            </p>
          )}
          <Link href={`/stones/${source.id}`} className="text-sm text-zinc-600 underline">
            Full cost ledger
          </Link>
        </section>
      )}
      </fieldset>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">History &amp; traceability</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Manufacturing stone number</dt>
              <dd className="mt-0.5">
                <Link href={`/stones/${source.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
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
                      <td className="py-2 text-zinc-800">{m.stage?.name ?? m.process ?? "—"}</td>
                      <td className="py-2 text-zinc-500">{m.party?.name ?? "—"}</td>
                      <td className="py-2 text-zinc-500">{formatDate(m.issueDate)}</td>
                      <td className="py-2 text-zinc-500">
                        {formatDate(m.returnDate)}
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
