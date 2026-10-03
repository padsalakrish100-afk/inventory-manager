import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate, todayIST } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MEMO_STATUS_LABELS, MEMO_STATUS_STYLES } from "@/lib/sales/constants";
import { describeStone } from "@/lib/sales/stones";
import { MemoLines } from "./memo-lines";

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("memo.manage");
  const { id } = await params;
  const memo = await prisma.salesMemo.findUnique({
    where: { id },
    include: {
      party: true,
      lines: {
        include: {
          stone: { include: { polishedStone: true } },
          invoiceLine: { select: { invoice: { select: { id: true, invoiceNo: true, voidedAt: true } } } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!memo || memo.voidedAt) notFound();

  const now = new Date();
  const overdue = memo.status !== "CLOSED" && memo.dueDate < now;
  const out = memo.lines.filter((l) => l.status === "OUT");
  const canInvoice = can(viewer, "sales.manage");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-zinc-900">{memo.memoNo}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${MEMO_STATUS_STYLES[memo.status]}`}>
              {MEMO_STATUS_LABELS[memo.status] ?? memo.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {memo.party.name} · {formatDate(memo.date)} ·{" "}
            <span className={overdue ? "font-medium text-red-700" : ""}>
              due {formatDate(memo.dueDate)}
              {overdue ? " (overdue)" : ""}
            </span>
          </p>
          <Link href="/sales/memos" className="text-sm text-zinc-500 hover:underline">
            &larr; Memos
          </Link>
        </div>
        <a
          href={`/api/documents/memo/${memo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Memo PDF
        </a>
      </div>

      <MemoLines
        memoId={memo.id}
        canInvoice={canInvoice}
        today={todayIST()}
        lines={memo.lines.map((l) => ({
          id: l.id,
          stoneId: l.stoneId,
          polishedId: l.stone.polishedStone?.id ?? null,
          stockId: l.stone.polishedStone?.stockId ?? l.stone.sku,
          description: l.stone.polishedStone ? describeStone(l.stone.polishedStone) : l.stone.name,
          carats: l.carats.toString(),
          amount: formatMoney(Number(l.amount), memo.currency),
          perCt: formatMoney(Number(l.pricePerCt), memo.currency),
          status: l.status,
          returnedAt: l.returnedAt ? formatDate(l.returnedAt) : null,
          invoice: l.invoiceLine && !l.invoiceLine.invoice.voidedAt ? { id: l.invoiceLine.invoice.id, no: l.invoiceLine.invoice.invoiceNo } : null,
        }))}
      />

      <p className="text-sm text-zinc-600">
        Out now: {out.length} {out.length === 1 ? "stone" : "stones"} · {out.reduce((a, l) => a + Number(l.carats), 0).toFixed(3)} ct ·{" "}
        {formatMoney(out.reduce((a, l) => a + Number(l.amount), 0), memo.currency)}
      </p>

      <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <h2 className="font-medium text-zinc-900">Details</h2>
        <p className="text-zinc-600">
          Currency {memo.currency}
          {memo.fxRate ? ` · ₹${memo.fxRate.toString()} per $` : ""}
        </p>
        {memo.terms && <p className="whitespace-pre-line text-zinc-600">{memo.terms}</p>}
        {memo.notes && <p className="text-zinc-500">Note: {memo.notes}</p>}
      </section>
    </div>
  );
}
