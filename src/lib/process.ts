export const PROCESS_VALUES = [
  "GALAXY",
  "PLANNING",
  "GREEN_SAWING",
  "QUAZER_SAWING",
  "WATERJET_SAWING",
  "BRUTING",
  "CHABKA",
  "POLISHING",
] as const;

export type ProcessValue = (typeof PROCESS_VALUES)[number];

// The three sawing machines are each their own process — different
// machines, different karigar rates — rather than one "Laser Sawing" with
// a sub-type, so they get full rate cards, tracking, and reporting for free.
export const SAWING_PROCESS_VALUES: readonly ProcessValue[] = ["GREEN_SAWING", "QUAZER_SAWING", "WATERJET_SAWING"];

export const PROCESS_OPTIONS: { value: ProcessValue; label: string }[] = [
  { value: "GALAXY", label: "Galaxy" },
  { value: "PLANNING", label: "Planning" },
  { value: "GREEN_SAWING", label: "Green Sawing" },
  { value: "QUAZER_SAWING", label: "Quazer Sawing" },
  { value: "WATERJET_SAWING", label: "Waterjet Sawing" },
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
  GREEN_SAWING: "bg-lime-50 text-lime-700",
  QUAZER_SAWING: "bg-violet-50 text-violet-700",
  WATERJET_SAWING: "bg-cyan-50 text-cyan-700",
  BRUTING: "bg-teal-50 text-teal-700",
  CHABKA: "bg-orange-50 text-orange-700",
  POLISHING: "bg-blue-50 text-blue-700",
};
