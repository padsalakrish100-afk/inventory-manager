import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getViewer, homePathFor } from "@/lib/authz";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { formatInr, formatUsd, toCents } from "@/lib/money";
import { VoidPaymentButton } from "./void-payment-button";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  const p = await prisma.payment.findUnique({
    where: { id },
    include: {
      party: { select: { name: true } },
      allocations: {
        include: {
          invoice: { select: { id: true, invoiceNo: true } },
          roughPurchase: { select: { id: true, purchaseNo: true } },
          jobWorkBill: { select: { id: true, billNo: true } },
        },
      },
    },
  });
  if (!p) notFound();
  if (!(p.direction === "OUT" ? can(viewer, "costs.view") : can(viewer, "sales.manage"))) redirect(homePathFor(viewer));

  const allocated = p.allocations.reduce((a, x) => a + toCents(x.amount), 0);
  const onAccount = toCents(p.amount) - allocated;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold text-zinc-900">{p.paymentNo}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>
            {p.direction === "IN" ? "Receipt" : "Payment out"}
          </span>
          {p.voidedAt && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Voided</span>}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {p.direction === "IN" ? "From" : "To"} {p.party.name} · {formatDate(p.date)}
        </p>
        {p.voidedAt && <p className="text-sm text-red-700">Voided {formatDateTime(p.voidedAt)}: {p.voidReason}</p>}
        <Link href="/sales/payments" className="text-sm text-zinc-500 hover:underline">
          &larr; Payments
        </Link>
      </div>

      <section className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <div className="flex justify-between font-medium text-zinc-900">
          <span>Amount</span>
          <span>{formatMoney(Number(p.amount), p.currency)}</span>
        </div>
        <div className="flex justify-between text-zinc-600">
          <span>In both currencies</span>
          <span>
            {formatUsd(p.amountUsd)} · {formatInr(p.amountInr)}
            {p.fxRate ? ` (₹${p.fxRate.toString()}/$)` : ""}
          </span>
        </div>
        {p.method && (
          <div className="flex justify-between text-zinc-600">
            <span>Method</span>
            <span>{p.method}</span>
          </div>
        )}
        {p.reference && (
          <div className="flex justify-between text-zinc-600">
            <span>Reference</span>
            <span>{p.reference}</span>
          </div>
        )}
        {p.notes && <p className="text-zinc-500">{p.notes}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">Settles</h2>
        <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm">
          {p.allocations.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 px-4 py-3">
              <span>
                {a.invoice && (
                  <Link href={`/sales/invoices/${a.invoice.id}`} className="font-mono text-xs font-medium hover:underline">
                    {p.direction === "OUT" ? `Brokerage on ${a.invoice.invoiceNo}` : a.invoice.invoiceNo}
                  </Link>
                )}
                {a.roughPurchase && (
                  <Link href={`/rough/${a.roughPurchase.id}`} className="font-mono text-xs font-medium hover:underline">
                    Rough {a.roughPurchase.purchaseNo}
                  </Link>
                )}
                {a.jobWorkBill && <span className="text-xs">Job-work bill {a.jobWorkBill.billNo}</span>}
              </span>
              <span className="font-medium">{formatMoney(Number(a.amount), p.currency)}</span>
            </li>
          ))}
          {onAccount > 0 && (
            <li className="flex justify-between gap-2 px-4 py-3 text-zinc-600">
              <span>Held on account</span>
              <span>{formatMoney(onAccount / 100, p.currency)}</span>
            </li>
          )}
        </ul>
      </section>

      {!p.voidedAt && can(viewer, "admin") && <VoidPaymentButton paymentId={p.id} />}
    </div>
  );
}
