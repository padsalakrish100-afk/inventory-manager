// Labels and choices shared by the sales screens (safe for client components).

export const PAYMENT_METHODS = ["Wire transfer", "RTGS / NEFT", "UPI", "Cheque", "Cash", "Card", "Other"] as const;

export const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FOB", "CIF"] as const;

export const MEMO_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  PARTIAL: "Partly settled",
  CLOSED: "Closed",
};

export const MEMO_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-purple-50 text-purple-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  CLOSED: "bg-zinc-100 text-zinc-600",
};

export const MEMO_LINE_LABELS: Record<string, string> = { OUT: "Out", RETURNED: "Returned", SOLD: "Sold" };

export type PayState = "UNPAID" | "PARTIAL" | "PAID";

export const PAY_STATE_LABELS: Record<PayState, string> = { UNPAID: "Unpaid", PARTIAL: "Part paid", PAID: "Paid" };

export const PAY_STATE_STYLES: Record<PayState, string> = {
  UNPAID: "bg-red-50 text-red-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
};

// Ageing buckets by days since the document date.
export const AGEING_BUCKETS = [
  { key: "d0", label: "0–30", max: 30 },
  { key: "d31", label: "31–60", max: 60 },
  { key: "d61", label: "61–90", max: 90 },
  { key: "d90", label: "90+", max: Infinity },
] as const;

export type AgeingKey = (typeof AGEING_BUCKETS)[number]["key"];

export function ageingBucket(days: number): AgeingKey {
  return AGEING_BUCKETS.find((b) => days <= b.max)!.key;
}

export const DEFAULT_MEMO_TERMS =
  "The goods listed are delivered on memorandum for examination only. They remain the property of the consignor until paid for in full and must be returned on demand or by the due date. The consignee is responsible for loss or damage from any cause while the goods are in their possession. Goods not returned by the due date may be invoiced at the prices shown.";

export const DEFAULT_INVOICE_WARRANTY =
  "The diamonds herein invoiced have been purchased from legitimate sources not involved in funding conflict and in compliance with United Nations resolutions. The seller hereby guarantees that these diamonds are conflict free, based on personal knowledge and/or written guarantees provided by the supplier of these diamonds.";
