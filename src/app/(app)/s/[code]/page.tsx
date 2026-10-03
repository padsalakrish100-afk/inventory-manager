import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { parseScannedCode } from "@/lib/stone/scan";

// Where every QR label points: resolves a scanned code to its record.
// Accepts a stone number, a polished Stock ID, a lot number, or a memo number.
export default async function ScanResolvePage({ params }: { params: Promise<{ code: string }> }) {
  await requirePagePermission("stones.view");
  const { code: rawCode } = await params;
  let decoded = rawCode;
  try {
    decoded = decodeURIComponent(rawCode);
  } catch {
    // Already decoded (or contains a bare %) — use as is.
  }
  const code = parseScannedCode(decoded);

  const stone = await prisma.product.findUnique({ where: { sku: code }, select: { id: true } });
  if (stone) redirect(`/stones/${stone.id}`);

  const polished = await prisma.polishedStone.findUnique({ where: { stockId: code }, select: { sourceProductId: true } });
  if (polished) redirect(`/stones/${polished.sourceProductId}`);

  const lot = await prisma.lot.findUnique({ where: { lotNumber: code }, select: { id: true } });
  if (lot) redirect(`/lotting/${lot.id}`);

  const memo = await prisma.memo.findUnique({ where: { memoNumber: code }, select: { id: true } });
  if (memo) redirect(`/manufacturing/memo/${memo.id}`);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Nothing found</h1>
      <p className="text-sm text-zinc-500">
        No stone, stock ID, lot, or memo matches <span className="font-mono text-zinc-800">{code}</span>.
      </p>
      <Link href="/scan" className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-base font-medium text-white">
        Scan again
      </Link>
    </div>
  );
}
