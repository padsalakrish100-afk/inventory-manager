// Money arithmetic in integer cents/paise — never floats for stored values.

export function toCents(value: { toString(): string } | number | string): number {
  return Math.round(Number(value.toString()) * 100);
}

export function centsToString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// The same amount in USD and INR at an exchange rate (INR per 1 USD).
// Without a rate only the amount's own currency is known.
export function inBothCurrencies(
  amount: { toString(): string } | number | string,
  currency: string,
  fxRate: { toString(): string } | number | string | null,
): { usd: string | null; inr: string | null } {
  const cents = toCents(amount);
  const fx = fxRate === null ? null : Number(fxRate.toString());
  if (currency === "USD") {
    return { usd: centsToString(cents), inr: fx ? centsToString(Math.round(cents * fx)) : null };
  }
  if (currency === "INR") {
    return { inr: centsToString(cents), usd: fx ? centsToString(Math.round(cents / fx)) : null };
  }
  return { usd: null, inr: null };
}

// Splits a total (in cents) across weights so the parts add up exactly to
// the total: each part is rounded down, and the leftover cents go to the
// parts with the largest remainders.
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return allocateCents(totalCents, weights.map(() => 1));
  const exact = weights.map((w) => (totalCents * w) / sum);
  const parts = exact.map((x) => Math.floor(x));
  let leftover = totalCents - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; leftover > 0; k = (k + 1) % order.length, leftover--) parts[order[k].i]++;
  return parts;
}

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inrFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function formatUsd(value: { toString(): string } | number | string | null): string {
  return value === null ? "—" : usdFormat.format(Number(value.toString()));
}

export function formatInr(value: { toString(): string } | number | string | null): string {
  return value === null ? "—" : inrFormat.format(Number(value.toString()));
}
