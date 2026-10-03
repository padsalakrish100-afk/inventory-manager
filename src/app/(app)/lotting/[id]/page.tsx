import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS, PROCESS_STYLES } from "@/lib/process";
import { DeleteLotButton } from "./delete-lot-button";
import { WeightCell } from "./weight-cell";
import { PurchaseCostEditor } from "./purchase-cost-editor";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { STONE_STATUS_LABELS, STONE_STATUS_STYLES } from "@/lib/stone/status";
import { formatMoney } from "@/lib/format";
import { LotCostPanel } from "./lot-cost-panel";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("lots.manage");
  const showCost = can(viewer, "costs.view");
  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      sourceParty: true,
      packet: { include: { purchase: { select: { id: true, purchaseNo: true, currency: true, fxRate: true } } } },
      products: {
        orderBy: { sku: "asc" },
        include: {
          currentParty: true,
          polishedStone: true,
          currentStage: { select: { name: true } },
          currentDepartment: { select: { name: true } },
        },
      },
    },
  });
  if (!lot) notFound();

  const availableCount = lot.products.filter(
    (p) => !p.currentStageId && !p.currentProcess && !p.polishedStone && p.status === "IN_PRODUCTION",
  ).length;
  const polishedCount = lot.products.filter((p) => p.polishedStone).length;

  const weighedStones = lot.products.filter((p) => p.caratWeight !== null);
  const enteredTotal = Math.round(weighedStones.reduce((sum, p) => sum + (p.caratWeight ?? 0), 0) * 1000) / 1000;
  const allWeighed = weighedStones.length === lot.products.length && lot.products.length > 0;
  const showVarianceCheck = lot.roughWeight !== null && weighedStones.length > 0;
  const diff = showVarianceCheck ? Math.round((enteredTotal - lot.roughWeight!) * 1000) / 1000 : 0;
  const diffPercent = showVarianceCheck && lot.roughWeight ? (diff / lot.roughWeight) * 100 : 0;
  const flagged = showVarianceCheck && allWeighed && Math.abs(diffPercent) > 2;

  // Rough cost currently on each stone (cost viewers only).
  const roughEntries = showCost
    ? await prisma.costEntry.findMany({
        where: { stoneId: { in: lot.products.map((p) => p.id) }, type: "ROUGH", voidedAt: null, sourceType: { not: "SPLIT" } },
        select: { stoneId: true, amount: true, currency: true },
      })
    : [];
  const roughBy = new Map(roughEntries.map((e) => [e.stoneId, e]));
  const roughTotals = new Map<string, number>();
  for (const e of roughEntries) roughTotals.set(e.currency, (roughTotals.get(e.currency) ?? 0) + Number(e.amount));
  const allocatedLabel =
    roughTotals.size > 0 ? [...roughTotals.entries()].map(([c, v]) => formatMoney(v, c)).join(" + ") : null;
  const costSource = lot.packet ? "packet" : lot.purchaseCost !== null ? "legacy" : "none";
  const costCurrency = lot.packet ? lot.packet.purchase.currency : lot.purchaseCurrency;
  const costAmount = lot.packet
    ? lot.packet.costShare !== null
      ? formatMoney(Number(lot.packet.costShare), lot.packet.purchase.currency)
      : null
    : lot.purchaseCost !== null
      ? lot.purchaseCurrency
        ? formatMoney(lot.purchaseCost, lot.purchaseCurrency)
        : lot.purchaseCost.toLocaleString("en-IN")
      : null;
  const stonesWithoutWeight = lot.products.filter((p) => !p.parentId && p.roughWeight === null && p.caratWeight === null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lot {lot.lotNumber}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500">
            <span>Source: {lot.sourceParty?.name ?? "—"}</span>
            <span>&middot; Rough weight: {lot.roughWeight ?? "—"} ct</span>
            {showCost && !lot.packet && (
              <>
                <span>&middot; Purchase cost:</span>
                <PurchaseCostEditor lotId={lot.id} initialCost={lot.purchaseCost} roughWeight={lot.roughWeight} />
              </>
            )}
            <span>&middot; {formatDate(lot.createdAt)}</span>
          </p>
          {lot.packet && (
            <p className="mt-1 text-sm text-zinc-500">
              From packet <span className="font-mono">{lot.packet.packetCode}</span> of{" "}
              <Link href={`/rough/${lot.packet.purchase.id}`} className="underline">
                {lot.packet.purchase.purchaseNo}
              </Link>
              {lot.description ? ` · ${lot.description}` : ""}
            </p>
          )}
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

      {showCost && (
        <LotCostPanel
          lotId={lot.id}
          source={costSource}
          amountLabel={costAmount}
          currency={costCurrency}
          fxRate={lot.packet ? (lot.packet.purchase.fxRate?.toString() ?? null) : (lot.purchaseFxRate?.toString() ?? null)}
          allocatedLabel={allocatedLabel}
          stonesWithoutWeight={stonesWithoutWeight}
        />
      )}

      {showVarianceCheck && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            flagged ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-200 bg-white text-zinc-600"
          }`}
        >
          <span className="font-medium">{enteredTotal} ct entered</span> ({weighedStones.length} of{" "}
          {lot.products.length} stone{lot.products.length === 1 ? "" : "s"} weighed)
          {allWeighed ? (
            <>
              {" "}
              vs {lot.roughWeight} ct rough weight — {diff >= 0 ? "+" : ""}
              {diff} ct ({diffPercent >= 0 ? "+" : ""}
              {diffPercent.toFixed(1)}%)
              {flagged && <span className="ml-2 font-medium">Worth double-checking against the scale.</span>}
            </>
          ) : (
            <span> — variance check runs once every stone has a weight entered.</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stone number</th>
              <th className="px-4 py-3 font-medium">Weight</th>
              <th className="px-4 py-3 font-medium">Current location</th>
              {showCost && <th className="px-4 py-3 font-medium text-right">Rough cost</th>}
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lot.products.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                <td className="px-4 py-3">
                  <WeightCell productId={p.id} initialWeight={p.caratWeight} />
                </td>
                <td className="px-4 py-3">
                  {p.polishedStone ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Polish ({p.polishedStone.stockId})
                    </span>
                  ) : p.currentStageId || p.currentProcess ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.currentProcess ? PROCESS_STYLES[p.currentProcess] : "bg-amber-50 text-amber-700"}`}
                    >
                      {p.currentStage?.name ?? (p.currentProcess ? PROCESS_LABELS[p.currentProcess] : "Out")}
                      {p.currentParty ? ` · ${p.currentParty.name}` : p.currentDepartment ? ` · ${p.currentDepartment.name}` : ""}
                    </span>
                  ) : p.status !== "IN_PRODUCTION" ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STONE_STATUS_STYLES[p.status]}`}>
                      {STONE_STATUS_LABELS[p.status]}
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      Available
                    </span>
                  )}
                </td>
                {showCost && (
                  <td className="px-4 py-3 text-right whitespace-nowrap text-zinc-600">
                    {roughBy.has(p.id) ? formatMoney(Number(roughBy.get(p.id)!.amount), roughBy.get(p.id)!.currency) : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Link href={`/stones/${p.id}`} className="text-zinc-600 hover:underline">
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
