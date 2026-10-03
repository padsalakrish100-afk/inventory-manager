// Loss on a return, computed in thousandths of a carat (integers) so
// floating-point noise never shows up in stored or displayed values.

function toMilli(value: number | string): number {
  return Math.round(Number(value) * 1000);
}

export type Loss = {
  lossWeight: string; // carats, 3 decimals
  lossPct: string | null; // % of issue weight, 3 decimals
};

// Loss = issue − return − tops. Tops are cut pieces recovered during sawing,
// so they're not counted as lost material.
export function computeLoss(
  issueWeight: number | string,
  returnWeight: number | string,
  topsWeight: number | string | null = null,
): Loss {
  const issue = toMilli(issueWeight);
  const lossMilli = issue - toMilli(returnWeight) - (topsWeight === null ? 0 : toMilli(topsWeight));
  const lossWeight = (lossMilli / 1000).toFixed(3);
  const lossPct = issue > 0 ? ((lossMilli / issue) * 100).toFixed(3) : null;
  return { lossWeight, lossPct };
}

export function isOverLimit(lossPct: string | null, limitPct: string | number | null): boolean {
  if (lossPct === null || limitPct === null) return false;
  return Number(lossPct) > Number(limitPct);
}
