export const PROCESS_VALUES = ["GALAXY", "SAWING", "CHABKA", "POLISHING"] as const;

export type ProcessValue = (typeof PROCESS_VALUES)[number];

export const PROCESS_OPTIONS: { value: ProcessValue; label: string }[] = [
  { value: "GALAXY", label: "Galaxy" },
  { value: "SAWING", label: "Sawing" },
  { value: "CHABKA", label: "Chabka" },
  { value: "POLISHING", label: "Polishing" },
];

export const PROCESS_LABELS: Record<string, string> = Object.fromEntries(
  PROCESS_OPTIONS.map((p) => [p.value, p.label]),
);

export const PROCESS_STYLES: Record<string, string> = {
  GALAXY: "bg-sky-50 text-sky-700",
  SAWING: "bg-amber-50 text-amber-700",
  CHABKA: "bg-orange-50 text-orange-700",
  POLISHING: "bg-blue-50 text-blue-700",
};
