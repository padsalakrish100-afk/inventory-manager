import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { AllocateButton, DeletePacketButton, KpForm, LotPacketForm, PacketForm, VoidPurchaseButton } from "./controls";

export default async function RoughPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("lots.manage");
  const showCosts = can(viewer, "costs.view");
  const { id } = await params;

  const purchase = await prisma.roughPurchase.findUnique({
    where: { id },
    include: {
      party: { select: { name: true } },
      packets: { include: { lot: { select: { id: true, lotNumber: true } } }, orderBy: { packetCode: "asc" } },
    },
  });
  if (!purchase) notFound();
  const files = await prisma.attachment.findMany({
    where: {
      entityId: id,
      deletedAt: null,
      entityType: { in: showCosts ? ["ROUGH_INVOICE", "ROUGH_KP"] : ["ROUGH_KP"] },
    },
    select: { id: true, entityType: true, fileName: true },
  });

  const caratsMilli = Math.round(Number(purchase.totalCarats) * 1000);
  const assortedMilli = purchase.packets.reduce((s, p) => s + Math.round(Number(p.carats) * 1000), 0);
  const assortedPieces = purchase.packets.reduce((s, p) => s + p.pieces, 0);
  const diffCt = (assortedMilli - caratsMilli) / 1000;
  const diffPcs = assortedPieces - purchase.pieces;
  const balanced = diffCt === 0 && diffPcs === 0;
  const voided = Boolean(purchase.voidedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {purchase.purchaseNo}
            {voided && <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700">Cancelled</span>}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {purchase.party.name}
            {purchase.source ? ` · ${purchase.source}` : ""} · {formatDate(purchase.date)}
          </p>
          <Link href="/rough" className="text-sm text-zinc-500 hover:underline">
            &larr; Rough purchases
          </Link>
        </div>
        {can(viewer, "admin") && !voided && !purchase.packets.some((p) => p.lot) && <VoidPurchaseButton purchaseId={purchase.id} />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Carats" value={`${Number(purchase.totalCarats).toFixed(3)} ct`} />
        <Stat label="Pieces" value={String(purchase.pieces)} />
        {showCosts && (
          <>
            <Stat label="Price per carat" value={formatMoney(Number(purchase.pricePerCarat), purchase.currency)} />
            <Stat
              label="Total"
              value={formatMoney(Number(purchase.totalAmount), purchase.currency)}
              sub={purchase.fxRate ? `at ₹${Number(purchase.fxRate)}/$` : "no exchange rate"}
            />
          </>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-medium text-zinc-900">Documents</h2>
        {showCosts && <p className="text-sm text-zinc-600">Invoice: {purchase.invoiceNo ?? "—"}</p>}
        <ul className="flex flex-wrap gap-2 text-sm">
          {files.length === 0 && <li className="text-zinc-500">No files attached.</li>}
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" className="rounded-md border border-zinc-200 px-2 py-1 hover:bg-zinc-50">
                {f.entityType === "ROUGH_KP" ? "KP" : "Invoice"}: {f.fileName ?? "file"}
              </a>
            </li>
          ))}
        </ul>
        {!purchase.kpCertNo && (
          <p className="text-sm font-medium text-red-700">Kimberley Process certificate missing — required before lotting.</p>
        )}
        <KpForm purchaseId={purchase.id} kpCertNo={purchase.kpCertNo} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Assortment</h2>
            <p className={`text-sm ${balanced ? "text-emerald-700" : "text-amber-700"}`}>
              Packets: {(assortedMilli / 1000).toFixed(3)} ct · {assortedPieces} pc —{" "}
              {balanced
                ? "matches the purchase."
                : `difference ${diffCt > 0 ? "+" : ""}${diffCt.toFixed(3)} ct, ${diffPcs > 0 ? "+" : ""}${diffPcs} pc vs purchase.`}
            </p>
          </div>
          {showCosts && !voided && purchase.packets.length > 0 && <AllocateButton purchaseId={purchase.id} />}
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Packet</th>
                <th className="px-4 py-2 font-medium">Size · quality · model</th>
                <th className="px-4 py-2 font-medium text-right">Carats</th>
                <th className="px-4 py-2 font-medium text-right">Pcs</th>
                {showCosts && <th className="px-4 py-2 font-medium text-right">Cost share</th>}
                <th className="px-4 py-2 font-medium text-right">Production</th>
              </tr>
            </thead>
            <tbody>
              {purchase.packets.length === 0 && (
                <tr>
                  <td colSpan={showCosts ? 6 : 5} className="px-4 py-6 text-center text-zinc-500">
                    Not assorted yet — add the packets below.
                  </td>
                </tr>
              )}
              {purchase.packets.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{p.packetCode}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {[p.sizeRange, p.quality, p.model].filter(Boolean).join(" · ") || "—"}
                    {p.notes && <span className="block text-xs text-zinc-400">{p.notes}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{Number(p.carats).toFixed(3)}</td>
                  <td className="px-4 py-2 text-right">{p.pieces}</td>
                  {showCosts && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {p.costShare !== null ? formatMoney(Number(p.costShare), purchase.currency) : <span className="text-zinc-400">not allocated</span>}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right">
                    {p.lot ? (
                      <Link href={`/lotting/${p.lot.id}`} className="font-medium text-zinc-900 hover:underline">
                        {p.lot.lotNumber}
                      </Link>
                    ) : voided ? (
                      "—"
                    ) : (
                      <span className="flex items-center justify-end gap-1">
                        <LotPacketForm packetId={p.id} pieces={p.pieces} />
                        <DeletePacketButton packetId={p.id} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!voided && <PacketForm purchaseId={purchase.id} />}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}
