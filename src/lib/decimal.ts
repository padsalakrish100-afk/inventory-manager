// Reading Prisma Decimal values for display maths. Stored values stay exact;
// converting to a JS number is only for showing, sorting and totals on
// screen (carats have 3 decimals and money 2, well inside float precision).

type DecimalLike = { toString(): string } | number | string;

export function num(v: DecimalLike | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

// Like num(), but missing values count as zero.
export function num0(v: DecimalLike | null | undefined): number {
  return num(v) ?? 0;
}
