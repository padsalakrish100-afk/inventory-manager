// Stone lifecycle status and physical location — labels, badge styles, and
// which status changes are allowed.

export const STONE_STATUS_VALUES = [
  "IN_PRODUCTION",
  "POLISHED",
  "AT_LAB",
  "IN_STOCK",
  "ON_MEMO",
  "SOLD",
  "RETURNED",
  "SPLIT",
  "BROKEN",
] as const;
export type StoneStatusValue = (typeof STONE_STATUS_VALUES)[number];

export const STONE_STATUS_LABELS: Record<StoneStatusValue, string> = {
  IN_PRODUCTION: "In production",
  POLISHED: "Polished",
  AT_LAB: "At lab",
  IN_STOCK: "In stock",
  ON_MEMO: "On memo",
  SOLD: "Sold",
  RETURNED: "Returned",
  SPLIT: "Split",
  BROKEN: "Broken",
};

export const STONE_STATUS_STYLES: Record<StoneStatusValue, string> = {
  IN_PRODUCTION: "bg-amber-50 text-amber-700",
  POLISHED: "bg-sky-50 text-sky-700",
  AT_LAB: "bg-indigo-50 text-indigo-700",
  IN_STOCK: "bg-emerald-50 text-emerald-700",
  ON_MEMO: "bg-purple-50 text-purple-700",
  SOLD: "bg-zinc-100 text-zinc-600",
  RETURNED: "bg-orange-50 text-orange-700",
  SPLIT: "bg-zinc-100 text-zinc-500",
  BROKEN: "bg-red-50 text-red-700",
};

// In Production → Polished → At Lab → In Stock → On Memo → Sold / Returned,
// plus the side exits (split, broken) and the ways back.
export const STONE_STATUS_TRANSITIONS: Record<StoneStatusValue, readonly StoneStatusValue[]> = {
  IN_PRODUCTION: ["POLISHED", "SPLIT", "BROKEN"],
  POLISHED: ["AT_LAB", "IN_STOCK", "BROKEN", "IN_PRODUCTION"],
  AT_LAB: ["IN_STOCK", "POLISHED"],
  IN_STOCK: ["AT_LAB", "ON_MEMO", "SOLD", "IN_PRODUCTION"],
  ON_MEMO: ["IN_STOCK", "SOLD"],
  SOLD: ["RETURNED"],
  RETURNED: ["IN_STOCK", "IN_PRODUCTION"],
  SPLIT: [],
  BROKEN: ["IN_PRODUCTION"],
};

export function canTransition(from: StoneStatusValue, to: StoneStatusValue): boolean {
  return from === to || STONE_STATUS_TRANSITIONS[from].includes(to);
}

export const STONE_LOCATION_VALUES = ["FACTORY", "OFFICE_SAFE", "ON_MEMO", "AT_LAB", "IN_TRANSIT", "SOLD"] as const;
export type StoneLocationValue = (typeof STONE_LOCATION_VALUES)[number];

export const STONE_LOCATION_LABELS: Record<StoneLocationValue, string> = {
  FACTORY: "Factory",
  OFFICE_SAFE: "Office safe",
  ON_MEMO: "On memo",
  AT_LAB: "At lab",
  IN_TRANSIT: "In transit",
  SOLD: "Sold",
};

// Locations a user can move a stone to directly. On memo, at lab, and sold
// are set by their own flows (memo, lab send, invoice), never by hand.
export const MANUAL_LOCATION_VALUES: readonly StoneLocationValue[] = ["FACTORY", "OFFICE_SAFE", "IN_TRANSIT"];

// Old Polish-module status → stone status, used while both exist.
export function stoneStatusFromPolishStatus(polishStatus: string): StoneStatusValue {
  switch (polishStatus) {
    case "SOLD":
      return "SOLD";
    case "ON_MEMO":
      return "ON_MEMO";
    default:
      return "IN_STOCK";
  }
}
