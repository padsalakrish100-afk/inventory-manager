// Condition of a stone when it comes back from a process.
export const RETURN_CONDITIONS = ["OK", "CHIPPED", "CRACKED", "BROKEN", "OTHER"] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  OK: "OK",
  CHIPPED: "Chipped",
  CRACKED: "Cracked",
  BROKEN: "Broken",
  OTHER: "Other",
};

export const BREAKAGE_REASONS = [
  "Natural cleavage",
  "Inclusion opened",
  "Sawing crack",
  "Bruting chip",
  "Polishing wheel",
  "Handling / dropped",
  "Other",
] as const;
