import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { formatUsd, toCents } from "@/lib/money";
import { payState } from "@/lib/sales/balances";
import { INCOTERMS, PAY_STATE_LABELS, PAY_STATE_STYLES } from "@/lib/sales/constants";
import { stoneCosts } from "@/lib/costing/ledger";
import { InvoiceDetailsForm, VoidInvoiceButton } from "./invoice-controls";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("sales.manage");
  const showCosts = can(viewer, "costs.view");
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      party: true,
      broker: { select: { name: true } },
      lines: { include: { stone: { include: { polishedStone: { select: { id: true, stockId: true } } } }, memoLine: { include: { memo: { select: { id: true, memoNo: true } } } } } },
      allocations: { include: { payment: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!inv) notFound();

  const live = inv.allocations.filter((a) => !a.payment.voidedAt);
  const receivedCents = live.filter((a) => a.payment.direction === "IN").reduce((s, a) => s + toCents(a.amount), 0);
  const brokeragePaidCents = live.filter((a) => a.payment.direction === "OUT").reduce((s, a) => s + toCents(a.amount), 0);
  const totalCents = toCents(inv.total);
  const state = payState(totalCents, receivedCents);
  const overdue = !inv.voidedAt && state !== "PAID" && inv.dueDate && inv.dueDate < new Date();
  const fx = inv.fxRate ? Number(inv.fxRate) : null;
  const toUsd = (amount: number) => (inv.currency === "USD" ? amount : fx ? amount / fx : null);

  // Profit uses the cost frozen at sale; older (legacy) lines fall back to the live ledger.
  const liveCosts = showCosts ? await stoneCosts(prisma, inv.lines.filter((l) => l.costUsd === null).map((l) => l.stoneId)) : null;
  const lineRows = inv.lines.map((l) => {
    const amount = Number(l.amount);
    const costUsd = !showCosts ? null : l.costUsd !== null ? Number(l.costUsd) : (liveCosts!.get(l.stoneId)?.usdCents ?? 0) / 100;
    const saleUsd = toUsd(amount);
    return { l, amount, costUsd, profitUsd: costUsd !== null && saleUsd !== null ? saleUsd - costUsd : null, frozen: l.costUsd !== null };
  });
  const totalCost = lineRows.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  const subtotalUsd = toUsd(Number(inv.subtotal));
  const brokerageUsd = inv.brokerageAmount ? toUsd(Number(inv.brokerageAmount)) : 0;
  const profit = subtotalUsd !== null && brokerageUsd !== null ? subtotalUsd - totalCost - brokerageUsd : null;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-zinc-900">{inv.invoiceNo}</h1>
            {inv.voidedAt ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">Voided</span>
            ) : (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PAY_STATE_STYLES[state]}`}>
                {PAY_STATE_LABELS[state]}
                {overdue ? " · overdue" : ""}
              </span>
            )}
            {inv.isLegacy && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">From earlier sale record</span>}
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {inv.party.name} · {formatDate(inv.date)}
            {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""} · {inv.currency}
            {inv.fxRate ? ` @ ₹${inv.fxRate.toString()}` : ""}
          </p>
          {inv.voidedAt && <p className="text-sm text-red-700">Voided {formatDate(inv.voidedAt)}: {inv.voidReason}</p>}
          <Link href="/sales/invoices" className="text-sm text-zinc-500 hover:underline">
            &larr; Invoices
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/documents/invoice/${inv.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Invoice PDF
          </a>
          {!inv.voidedAt && state !== "PAID" && (
            <Link
              href={`/sales/payments/new?direction=IN&party=${inv.partyId}&currency=${inv.currency}`}
              className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
            >
              Record receipt
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Stock ID</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Carats</th>
              <th className="px-3 py-2 font-medium text-right">Per ct</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              {showCosts && <th className="px-3 py-2 font-medium text-right">Cost (USD)</th>}
              {showCosts && <th className="px-3 py-2 font-medium text-right">Profit (USD)</th>}
            </tr>
          </thead>
          <tbody>
            {lineRows.map(({ l, amount, costUsd, profitUsd, frozen }) => (
              <tr key={l.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2">
                  {l.stone.polishedStone ? (
                    <Link href={`/polish/${l.stone.polishedStone.id}`} className="font-mono text-xs font-medium hover:underline">
                      {l.stone.polishedStone.stockId}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{l.stone.sku}</span>
                  )}
                  {l.memoLine && (
                    <Link href={`/sales/memos/${l.memoLine.memo.id}`} className="block text-xs text-purple-700 hover:underline">
                      from {l.memoLine.memo.memoNo}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-600">{l.description ?? "—"}</td>
                <td className="px-3 py-2 text-right">{Number(l.carats).toFixed(3)}</td>
                <td className="px-3 py-2 text-right text-zinc-600">{formatMoney(Number(l.pricePerCt), inv.currency)}</td>
                <td className="px-3 py-2 text-right text-zinc-900">{formatMoney(amount, inv.currency)}</td>
                {showCosts && (
                  <td className="px-3 py-2 text-right text-zinc-600" title={frozen ? "Cost when sold" : "Current ledger cost (older sale)"}>
                    {formatUsd(costUsd)}
                    {!frozen && "*"}
                  </td>
                )}
                {showCosts && (
                  <td className={`px-3 py-2 text-right ${profitUsd !== null && profitUsd < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {formatUsd(profitUsd)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <Row label="Subtotal" value={formatMoney(Number(inv.subtotal), inv.currency)} />
          {inv.shipping && <Row label="Shipping" value={formatMoney(Number(inv.shipping), inv.currency)} />}
          {inv.insurance && <Row label="Insurance" value={formatMoney(Number(inv.insurance), inv.currency)} />}
          <Row label="Total" value={formatMoney(totalCents / 100, inv.currency)} strong />
          {inv.currency === "INR" && inv.totalUsd && <Row label="≈ USD" value={formatUsd(inv.totalUsd)} />}
          {inv.currency === "USD" && inv.totalInr && <Row label="≈ INR" value={formatMoney(Number(inv.totalInr), "INR")} />}
          <Row label="Received" value={formatMoney(receivedCents / 100, inv.currency)} />
          <Row label="Outstanding" value={formatMoney((totalCents - receivedCents) / 100, inv.currency)} strong />
        </section>
        <section className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          {inv.broker ? (
            <>
              <Row label="Broker" value={inv.broker.name} />
              <Row label="Brokerage" value={`${inv.brokeragePct?.toString() ?? "—"}% · ${formatMoney(Number(inv.brokerageAmount ?? 0), inv.currency)}`} />
              <Row label="Brokerage paid" value={formatMoney(brokeragePaidCents / 100, inv.currency)} />
            </>
          ) : (
            <p className="text-zinc-500">No broker.</p>
          )}
          {showCosts && profit !== null && (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <Row label="Cost" value={formatUsd(totalCost)} />
              <Row label="Profit after brokerage" value={`${formatUsd(profit)}${totalCost > 0 ? ` (${((profit / totalCost) * 100).toFixed(1)}% on cost)` : ""}`} strong />
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">Payments</h2>
        {inv.allocations.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm">
            {inv.allocations.map((a) => (
              <li key={a.id} className={`flex flex-wrap justify-between gap-2 px-4 py-3 ${a.payment.voidedAt ? "opacity-50 line-through" : ""}`}>
                <span>
                  <Link href={`/sales/payments/${a.payment.id}`} className="font-mono text-xs font-medium hover:underline">
                    {a.payment.paymentNo}
                  </Link>{" "}
                  · {formatDate(a.payment.date)} · {a.payment.direction === "IN" ? "Receipt" : "Brokerage paid"}
                  {a.payment.method ? ` · ${a.payment.method}` : ""}
                </span>
                <span className="font-medium">{formatMoney(Number(a.amount), inv.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!inv.voidedAt && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Shipping &amp; export details</h2>
          <InvoiceDetailsForm
            invoiceId={inv.id}
            incoterms={[...INCOTERMS]}
            defaults={{
              dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "",
              shipToName: inv.shipToName ?? "",
              shipToAddress: inv.shipToAddress ?? "",
              shipToCountry: inv.shipToCountry ?? "",
              incoterm: inv.incoterm ?? "",
              hsCode: inv.hsCode ?? "",
              portOfLoading: inv.portOfLoading ?? "",
              portOfDischarge: inv.portOfDischarge ?? "",
              awbNo: inv.awbNo ?? "",
              carrier: inv.carrier ?? "",
              kpCertNo: inv.kpCertNo ?? "",
              notes: inv.notes ?? "",
            }}
          />
        </section>
      )}

      {!inv.voidedAt && can(viewer, "admin") && <VoidInvoiceButton invoiceId={inv.id} hasPayments={live.length > 0} />}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-medium text-zinc-900" : "text-zinc-600"}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
