import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getViewer, homePathFor } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { toCents } from "@/lib/money";
import { SalesNav } from "../sales-nav";

const PAGE_SIZE = 50;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ dir?: string; q?: string; page?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const canIn = can(viewer, "sales.manage");
  const canOut = can(viewer, "costs.view");
  if (!canIn && !canOut) redirect(homePathFor(viewer));
  const sp = await searchParams;
  const allowed = [canIn && "IN", canOut && "OUT"].filter(Boolean) as string[];
  const dir = sp.dir && allowed.includes(sp.dir) ? sp.dir : null;
  const q = sp.q?.trim().slice(0, 60) ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    direction: dir ? dir : { in: allowed },
    ...(q
      ? {
          OR: [
            { paymentNo: { contains: q, mode: "insensitive" as const } },
            { reference: { contains: q, mode: "insensitive" as const } },
            { party: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { party: { select: { name: true } }, allocations: { select: { amount: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { dir, q: q || null, page: null as string | null, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/sales/payments${p.size ? `?${p}` : ""}`;
  };
  const tab = (key: string | null, label: string) => (
    <Link
      href={href({ dir: key })}
      className={`min-h-10 rounded-md px-3 py-2 text-sm ${dir === key ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Payments</h1>
            <p className="mt-1 text-sm text-zinc-500">Money received from customers and paid to suppliers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canIn && (
              <Link href="/sales/payments/new?direction=IN" className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110">
                Record receipt
              </Link>
            )}
            {canOut && (
              <Link href="/sales/payments/new?direction=OUT" className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">
                Record payment out
              </Link>
            )}
          </div>
        </div>
        <SalesNav viewer={viewer} current="/sales/payments" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allowed.length > 1 && (
          <>
            {tab(null, "All")}
            {tab("IN", "Received")}
            {tab("OUT", "Paid out")}
          </>
        )}
        <form className="ml-auto flex gap-2">
          {dir && <input type="hidden" name="dir" value={dir} />}
          <input name="q" defaultValue={q} placeholder="No., reference, party" className="min-h-10 w-56 rounded-md border border-zinc-300 px-3 text-sm" />
          <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Search</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium text-right">On account</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No payments recorded.
                </td>
              </tr>
            )}
            {payments.map((p) => {
              const unallocated = toCents(p.amount) - p.allocations.reduce((a, x) => a + toCents(x.amount), 0);
              return (
                <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.voidedAt ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`/sales/payments/${p.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                      {p.paymentNo}
                    </Link>
                    {p.voidedAt && <span className="ml-2 text-xs text-zinc-500">voided</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 text-zinc-700">{p.party.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.method ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${p.direction === "IN" ? "text-emerald-700" : "text-zinc-900"}`}>
                    {p.direction === "IN" ? "+" : "−"}
                    {formatMoney(Number(p.amount), p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">{unallocated > 0 ? formatMoney(unallocated / 100, p.currency) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5">&larr; Previous</Link> : <span />}
          <span className="text-zinc-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5">Next &rarr;</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
