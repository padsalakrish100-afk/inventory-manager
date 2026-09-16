export const PROCESS_VALUES = [
  "GALAXY",
  "PLANNING",
  "LASER_SAWING",
  "BRUTING",
  "CHABKA",
  "POLISHING",
] as const;

export type ProcessValue = (typeof PROCESS_VALUES)[number];

export const PROCESS_OPTIONS: { value: ProcessValue; label: string }[] = [
  { value: "GALAXY", label: "Galaxy" },
  { value: "PLANNING", label: "Planning" },
  { value: "LASER_SAWING", label: "Laser Sawing" },
  { value: "BRUTING", label: "Bruting" },
  { value: "CHABKA", label: "Chabka" },
  { value: "POLISHING", label: "Polishing" },
];

export const PROCESS_LABELS: Record<string, string> = Object.fromEntries(
  PROCESS_OPTIONS.map((p) => [p.value, p.label]),
);

export const PROCESS_STYLES: Record<string, string> = {
  GALAXY: "bg-sky-50 text-sky-700",
  PLANNING: "bg-indigo-50 text-indigo-700",
  LASER_SAWING: "bg-amber-50 text-amber-700",
  BRUTING: "bg-teal-50 text-teal-700",
  CHABKA: "bg-orange-50 text-orange-700",
  POLISHING: "bg-blue-50 text-blue-700",
};
