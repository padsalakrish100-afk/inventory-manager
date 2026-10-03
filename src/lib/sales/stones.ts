import "server-only";
import { num } from "@/lib/decimal";
import type { Tx } from "@/lib/audit";
import { CUT_STYLE_LABELS } from "@/lib/cuts";

type Describable = {
  cutStyle: string | null;
  shape: string | null;
  color: string | null;
  clarity: string | null;
  certLab: string | null;
  certNumber: string | null;
};

// "Old Mine Cut Cushion, H VS2, GIA 2215543210" — the line text on memos
// and invoices.
export function describeStone(p: Describable): string {
  const cut = p.cutStyle ? (CUT_STYLE_LABELS[p.cutStyle] ?? p.cutStyle) : null;
  const shape = p.shape && !(cut && cut.toLowerCase().startsWith(p.shape.toLowerCase())) ? p.shape : null;
  const parts = [
    [cut, shape].filter(Boolean).join(" "),
    [p.color, p.clarity].filter(Boolean).join(" "),
    p.certNumber ? `${p.certLab ?? "Cert"} ${p.certNumber}` : null,
  ].filter((x) => x);
  return parts.join(", ") || "Polished diamond";
}

// A polished stone's weight for a document: its graded carats, else the
// stone's current weight.
export function caratsOf(polished: { caratWeight: { toString(): string } | null }, product: { caratWeight: { toString(): string } | null }): string {
  const ct = num(polished.caratWeight) ?? num(product.caratWeight) ?? 0;
  return ct.toFixed(3);
}

// OPEN while every line is out, CLOSED once none is, PARTIAL in between.
export async function refreshMemoStatus(tx: Tx, memoIds: string[]): Promise<void> {
  for (const memoId of new Set(memoIds)) {
    const lines = await tx.salesMemoLine.findMany({ where: { memoId }, select: { status: true } });
    const out = lines.filter((l) => l.status === "OUT").length;
    const status = out === lines.length ? "OPEN" : out === 0 ? "CLOSED" : "PARTIAL";
    await tx.salesMemo.update({ where: { id: memoId }, data: { status } });
  }
}
