import { num0 } from "@/lib/decimal";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PROCESS_LABELS } from "@/lib/process";
import { formatDate } from "@/lib/dates";
import { PrintLabelButton } from "@/components/barcode-label";

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("mfg.view");
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
    include: {
      party: true,
      department: true,
      stage: true,
      movements: { include: { product: true, issuedBy: { select: { name: true } } }, orderBy: { product: { sku: "asc" } } },
    },
  });
  if (!memo) notFound();

  const active = memo.movements.filter((m) => !m.voidedAt);
  const totalWeight = active.reduce((sum, m) => sum + num0(m.issueWeight), 0);
  const totalPieces = active.reduce((sum, m) => sum + m.issuePieces, 0);
  const issuedBy = memo.movements[0]?.issuedBy?.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Memo {memo.memoNumber}</h1>
        <PrintLabelButton />
      </div>

      <div className="print-label mx-auto w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Issue memo</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{memo.memoNumber}</p>
          </div>
          <div className="text-right text-sm text-zinc-500">
            <p>{formatDate(memo.date)}</p>
            <p className="mt-1 font-medium text-zinc-800">
              {memo.stage?.name ?? (memo.process ? PROCESS_LABELS[memo.process] : "—")}
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <p className="text-zinc-500">Issued to</p>
          <p className="text-lg font-medium text-zinc-900">
            {memo.party?.name ?? (memo.department ? `${memo.department.name} department` : "—")}
          </p>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="py-2 font-medium">#</th>
              <th className="py-2 font-medium">Stone number</th>
              <th className="py-2 font-medium text-right">Pcs</th>
              <th className="py-2 font-medium text-right">Weight (ct)</th>
            </tr>
          </thead>
          <tbody>
            {memo.movements.map((m, i) => (
              <tr key={m.id} className={`border-b border-zinc-100 ${m.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                <td className="py-2 text-zinc-500">{i + 1}</td>
                <td className="py-2 font-mono text-xs text-zinc-800">{m.product.sku}</td>
                <td className="py-2 text-right text-zinc-800">{m.issuePieces}</td>
                <td className="py-2 text-right text-zinc-800">{m.issueWeight?.toFixed(3) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {active.length} stone{active.length === 1 ? "" : "s"}
              </td>
              <td className="pt-3 text-right font-semibold text-zinc-900">{totalPieces}</td>
              <td className="pt-3 text-right font-semibold text-zinc-900">{totalWeight.toFixed(3)} ct</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 flex justify-between text-sm">
          <div className="w-40 border-t border-zinc-400 pt-2 text-zinc-600 sm:w-48">
            Issued by{issuedBy ? `: ${issuedBy}` : ""}
          </div>
          <div className="w-40 border-t border-zinc-400 pt-2 text-right text-zinc-600 sm:w-48">Receiver&apos;s sign</div>
        </div>
      </div>
    </div>
  );
}
