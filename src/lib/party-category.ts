export const PARTY_CATEGORY_VALUES = ["TENDER_VENDOR", "KARIGAR", "CUSTOMER"] as const;

export type PartyCategoryValue = (typeof PARTY_CATEGORY_VALUES)[number];

export const PARTY_CATEGORY_OPTIONS: { value: PartyCategoryValue; label: string }[] = [
  { value: "TENDER_VENDOR", label: "Tender / vendor" },
  { value: "KARIGAR", label: "Karigar" },
  { value: "CUSTOMER", label: "Customer" },
];

export const PARTY_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PARTY_CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
);

export const PARTY_CATEGORY_STYLES: Record<string, string> = {
  TENDER_VENDOR: "bg-sky-50 text-sky-700",
  KARIGAR: "bg-amber-50 text-amber-700",
  CUSTOMER: "bg-emerald-50 text-emerald-700",
};
