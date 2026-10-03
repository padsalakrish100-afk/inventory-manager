const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | { toString(): string }): string {
  return currencyFormatter.format(Number(value.toString()));
}

export function formatNumber(value: number | { toString(): string }): string {
  return new Intl.NumberFormat("en-IN").format(Number(value.toString()));
}

// Unlike formatCurrency (locked to ₹ for the rest of the app), a
// PolishedStone's price is tagged with its own currency (default "USD"),
// so formatting it needs to respect that instead of assuming INR.
// Accepts a Prisma Decimal as well as a number.
export function formatMoney(input: number | { toString(): string }, currency: string = "USD"): string {
  const value = Number(input.toString());
  try {
    // Rupees use Indian digit grouping (₹2,50,000.00); everything else US.
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
