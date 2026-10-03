import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { toCents } from "@/lib/money";
import { invoicePayments, payState } from "@/lib/sales/balances";
import { PAY_STATE_LABELS, PAY_STATE_STYLES } from "@/lib/sales/constants";
import type { Prisma } from "@/generated/prisma/client";
import { SalesNav } from "../sales-nav";

const PAGE_SIZE = 50;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; voided?: string; page?: string }> }) {
  const viewer = await requirePagePermission("sales.manage");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) ?? "";
  const showVoided = sp.voided === "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.InvoiceWhereInput = {
    ...(showVoided ? {} : { voidedAt: null }),
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { party: { name: { contains: q, mode: "insensitive" } } },
            { lines: { some: { stone: { polishedStone: { stockId: { contains: q, mode: "insensitive" } } } } } },
          ],
        }
      : {}),
  };
  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { party: { select: { name: true } }, _count: { select: { lines: true } } },
      orderBy: [{ date: "desc" }, { invoiceNo: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const paid = await invoicePayments(prisma, invoices.map((i) => i.id));
  const now = new Date();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (showVoided) p.set("voided", "1");
    if (n > 1) p.set("page", String(n));
    return `/sales/invoices${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Invoices</h1>
            <p className="mt-1 text-sm text-zinc-500">{total.toLocaleString("en-IN")} sales invoices.</p>
          </div>
          <Link href="/sales/invoices/new" className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110">
            New invoice
          </Link>
        </div>
        <SalesNav viewer={viewer} current="/sales/invoices" />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Invoice no., customer, Stock ID" className="min-h-10 w-64 rounded-md border border-zinc-300 px-3 text-sm" />
        <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" name="voided" value="1" defaultChecked={showVoided} className="h-4 w-4" />
          Show voided
        </label>
        <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Search</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium text-right">Stones</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const totalCents = toCents(inv.total);
              const received = paid.get(inv.id)?.receivedCents ?? 0;
              const state = payState(totalCents, received);
              const overdue = !inv.voidedAt && state !== "PAID" && inv.dueDate && inv.dueDate < now;
              return (
                <tr key={inv.id} className={`border-b border-zinc-100 last:border-0 ${inv.voidedAt ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`/sales/invoices/${inv.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                      {inv.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(inv.date)}</td>
                  <td className="px-4 py-3 text-zinc-700">{inv.party.name}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">{inv._count.lines}</td>
                  <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(totalCents / 100, inv.currency)}</td>
                  <td className={`px-4 py-3 text-right ${overdue ? "font-medium text-red-700" : "text-zinc-700"}`}>
                    {inv.voidedAt ? "—" : formatMoney((totalCents - received) / 100, inv.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.voidedAt ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Voided</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAY_STATE_STYLES[state]}`}>
                        {PAY_STATE_LABELS[state]}
                        {overdue ? " · overdue" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5">&larr; Previous</Link> : <span />}
          <span className="text-zinc-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5">Next &rarr;</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
