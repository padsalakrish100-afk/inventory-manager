export const CERT_VALUES = ["NONE", "GIA", "IGI"] as const;

export type CertValue = (typeof CERT_VALUES)[number];

export const CERT_OPTIONS: { value: CertValue; label: string }[] = [
  { value: "NONE", label: "No certification" },
  { value: "GIA", label: "GIA" },
  { value: "IGI", label: "IGI" },
];

export const CERT_LABELS: Record<string, string> = Object.fromEntries(
  CERT_OPTIONS.map((c) => [c.value, c.label]),
);

export const CERT_STYLES: Record<string, string> = {
  NONE: "bg-zinc-100 text-zinc-600",
  GIA: "bg-blue-50 text-blue-700",
  IGI: "bg-indigo-50 text-indigo-700",
};
