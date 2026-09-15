export const STAGE_VALUES = [
  "ROUGH",
  "GALAXY",
  "SAWING",
  "CUTTING",
  "POLISHING",
  "CERTIFICATION",
  "COMPLETED",
] as const;

export type StageValue = (typeof STAGE_VALUES)[number];

export const STAGE_OPTIONS: { value: StageValue; label: string }[] = [
  { value: "ROUGH", label: "Rough" },
  { value: "GALAXY", label: "Galaxy (scanning/planning)" },
  { value: "SAWING", label: "Sawing" },
  { value: "CUTTING", label: "Cutting" },
  { value: "POLISHING", label: "Polishing" },
  { value: "CERTIFICATION", label: "Certification" },
  { value: "COMPLETED", label: "Completed" },
];

// Stages that belong on the Manufacturing view — everything before a stone
// is finished and moved to Polish (finished-goods) inventory.
export const MANUFACTURING_STAGE_OPTIONS = STAGE_OPTIONS.filter((s) => s.value !== "COMPLETED");

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.value, s.label]),
);

export const STAGE_STYLES: Record<string, string> = {
  ROUGH: "bg-zinc-100 text-zinc-600",
  GALAXY: "bg-sky-50 text-sky-700",
  SAWING: "bg-amber-50 text-amber-700",
  CUTTING: "bg-amber-50 text-amber-700",
  POLISHING: "bg-blue-50 text-blue-700",
  CERTIFICATION: "bg-purple-50 text-purple-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};
