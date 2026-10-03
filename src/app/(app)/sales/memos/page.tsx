import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MEMO_STATUS_LABELS, MEMO_STATUS_STYLES } from "@/lib/sales/constants";
import type { Prisma } from "@/generated/prisma/client";
import { SalesNav } from "../sales-nav";

type Search = { show?: string; q?: string };

export default async function MemosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requirePagePermission("memo.manage");
  const sp = await searchParams;
  const show = ["open", "overdue", "closed", "all"].includes(sp.show ?? "") ? sp.show! : "open";
  const q = sp.q?.trim().slice(0, 60) ?? "";
  const now = new Date();

  const where: Prisma.SalesMemoWhereInput = {
    voidedAt: null,
    ...(show === "open" ? { status: { in: ["OPEN", "PARTIAL"] } } : {}),
    ...(show === "overdue" ? { status: { in: ["OPEN", "PARTIAL"] }, dueDate: { lt: now } } : {}),
    ...(show === "closed" ? { status: "CLOSED" } : {}),
    ...(q
      ? {
          OR: [
            { memoNo: { contains: q, mode: "insensitive" } },
            { party: { name: { contains: q, mode: "insensitive" } } },
            { lines: { some: { stone: { polishedStone: { stockId: { contains: q, mode: "insensitive" } } } } } },
          ],
        }
      : {}),
  };
  const [memos, overdueCount] = await Promise.all([
    prisma.salesMemo.findMany({
      where,
      include: { party: { select: { name: true } }, lines: { select: { status: true, carats: true, amount: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.salesMemo.count({ where: { voidedAt: null, status: { in: ["OPEN", "PARTIAL"] }, dueDate: { lt: now } } }),
  ]);

  const tab = (key: string, label: string) => (
    <Link
      href={`/sales/memos${key === "open" ? "" : `?show=${key}`}`}
      className={`min-h-10 rounded-md px-3 py-2 text-sm ${show === key ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Memos</h1>
            <p className="mt-1 text-sm text-zinc-500">Stones out on consignment with customers.</p>
          </div>
          <Link href="/sales/memos/new" className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110">
            New memo
          </Link>
        </div>
        <SalesNav viewer={viewer} current="/sales/memos" />
      </div>

      {overdueCount > 0 && show !== "overdue" && (
        <Link href="/sales/memos?show=overdue" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 hover:bg-red-100">
          {overdueCount} {overdueCount === 1 ? "memo is" : "memos are"} past the due date — view
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {tab("open", "Open")}
        {tab("overdue", `Overdue${overdueCount ? ` (${overdueCount})` : ""}`)}
        {tab("closed", "Closed")}
        {tab("all", "All")}
        <form className="ml-auto flex gap-2">
          {show !== "open" && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} placeholder="Memo no., customer, Stock ID" className="min-h-10 w-56 rounded-md border border-zinc-300 px-3 text-sm" />
          <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Search</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Memo</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium text-right">Out</th>
              <th className="px-4 py-3 font-medium text-right">Value out</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {memos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No memos here.
                </td>
              </tr>
            )}
            {memos.map((m) => {
              const out = m.lines.filter((l) => l.status === "OUT");
              const overdue = m.status !== "CLOSED" && m.dueDate < now;
              return (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/sales/memos/${m.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                      {m.memoNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{m.party.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(m.date)}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-red-700" : "text-zinc-500"}`}>
                    {formatDate(m.dueDate)}
                    {overdue && " · overdue"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {out.length}/{m.lines.length} · {out.reduce((a, l) => a + Number(l.carats), 0).toFixed(3)} ct
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-900">
                    {formatMoney(out.reduce((a, l) => a + Number(l.amount), 0), m.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MEMO_STATUS_STYLES[m.status]}`}>
                      {MEMO_STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
