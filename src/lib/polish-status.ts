export const POLISH_STATUS_VALUES = ["AVAILABLE", "RESERVED", "ON_MEMO", "SOLD"] as const;

export type PolishStatusValue = (typeof POLISH_STATUS_VALUES)[number];

export const POLISH_STATUS_OPTIONS: { value: PolishStatusValue; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "RESERVED", label: "Reserved" },
  { value: "ON_MEMO", label: "On memo" },
  { value: "SOLD", label: "Sold" },
];

export const POLISH_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  POLISH_STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

export const POLISH_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  RESERVED: "bg-amber-50 text-amber-700",
  ON_MEMO: "bg-purple-50 text-purple-700",
  SOLD: "bg-zinc-100 text-zinc-600",
};

export const PAYMENT_STATUS_VALUES = ["UNPAID", "PARTIAL", "PAID"] as const;

export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatusValue; label: string }[] = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
];

export const PAYMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-red-50 text-red-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
};

// Total cost is derived, never stored — always the sum of whichever cost
// components have been entered so far.
export function computeTotalCost(stone: {
  roughCostAlloc: number | null;
  laborCost: number | null;
  certCost: number | null;
  otherCost: number | null;
}): number {
  return (
    (stone.roughCostAlloc ?? 0) + (stone.laborCost ?? 0) + (stone.certCost ?? 0) + (stone.otherCost ?? 0)
  );
}

export function daysInStock(createdAt: Date): number {
  const ms = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
