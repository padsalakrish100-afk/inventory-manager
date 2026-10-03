// Cut styles Opulent Diam works in — antique and specialty first.
export const CUT_STYLES = [
  { value: "OLD_MINE", label: "Old Mine Cut" },
  { value: "OLD_EUROPEAN", label: "Old European Cut" },
  { value: "ROSE", label: "Rose Cut" },
  { value: "STEP", label: "Step Cut" },
  { value: "PORTRAIT", label: "Portrait Cut" },
  { value: "MODERN", label: "Modern brilliant" },
  { value: "OTHER", label: "Other" },
] as const;

export const CUT_STYLE_LABELS: Record<string, string> = Object.fromEntries(CUT_STYLES.map((c) => [c.value, c.label]));

export const SHAPES = [
  "Cushion",
  "Round",
  "Oval",
  "Pear",
  "Marquise",
  "Emerald",
  "Asscher",
  "Square",
  "Kite",
  "Shield",
  "Hexagon",
  "Free form",
] as const;
