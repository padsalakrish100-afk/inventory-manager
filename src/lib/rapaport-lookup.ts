import "server-only";
import { num, num0 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { normaliseClarity, normaliseColor, rapShapeGroupFor } from "@/lib/rapaport";

export type RapStone = { id: string; shape: string | null; cutStyle: string | null; color: string | null; clarity: string | null; carat: { toString(): string } | number | null };

// Rap list price per carat (USD) for each stone from the latest uploaded
// list, or null where the list has no matching row (unknown color/clarity,
// out-of-range size, or no list uploaded).
export async function rapPricesFor(stones: RapStone[]): Promise<{ listDate: Date | null; prices: Map<string, number> }> {
  const prices = new Map<string, number>();
  const list = await prisma.rapaportList.findFirst({ orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }], select: { id: true, effectiveDate: true } });
  if (!list) return { listDate: null, prices };

  const wanted = stones.filter((s) => s.color && s.clarity && num(s.carat));
  if (wanted.length === 0) return { listDate: list.effectiveDate, prices };
  const rows = await prisma.rapaportPrice.findMany({
    where: {
      listId: list.id,
      color: { in: [...new Set(wanted.map((s) => normaliseColor(s.color!)))] },
      clarity: { in: [...new Set(wanted.map((s) => normaliseClarity(s.clarity!)))] },
    },
    select: { shapeGroup: true, color: true, clarity: true, caratFrom: true, caratTo: true, pricePerCt: true },
  });
  for (const s of wanted) {
    const group = rapShapeGroupFor(s.shape, s.cutStyle);
    const color = normaliseColor(s.color!);
    const clarity = normaliseClarity(s.clarity!);
    // Rap sizes are bands like 1.00–1.49; compare at 2 decimals.
    const ct = Math.floor(num0(s.carat) * 100) / 100;
    const row = rows.find(
      (r) => r.shapeGroup === group && r.color === color && r.clarity === clarity && ct >= Number(r.caratFrom) && ct <= Number(r.caratTo),
    );
    if (row) prices.set(s.id, Number(row.pricePerCt));
  }
  return { listDate: list.effectiveDate, prices };
}
