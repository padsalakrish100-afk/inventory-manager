// Rapaport price lists — uploaded by you as CSV, never scraped.
//
// Accepted CSV: a header row with (case-insensitive, any order) columns for
// shape, clarity, color, low size, high size, and price (Rapaport "hundreds"
// of USD per carat, e.g. 54 = $5,400/ct). Common RapNet column names are
// recognised.

export type RapRow = {
  shapeGroup: "ROUND" | "PEAR";
  color: string;
  clarity: string;
  caratFrom: string;
  caratTo: string;
  pricePerCt: string; // USD per carat
};

const ALIASES: Record<keyof Omit<RapRow, "pricePerCt"> | "price", string[]> = {
  shapeGroup: ["shape", "shapes"],
  clarity: ["clarity"],
  color: ["color", "colour"],
  caratFrom: ["low size", "lowsize", "low_size", "size from", "from", "carat from", "low"],
  caratTo: ["high size", "highsize", "high_size", "size to", "to", "carat to", "high"],
  price: ["price", "rap price", "rap", "price (hundreds)"],
};

export function normaliseColor(v: string): string {
  return v.trim().toUpperCase();
}

export function normaliseClarity(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

function shapeGroupOf(raw: string): "ROUND" | "PEAR" {
  const v = raw.trim().toUpperCase();
  return v === "BR" || v === "RB" || v.startsWith("ROUND") ? "ROUND" : "PEAR";
}

// Rapaport publishes a round table and a pear table used for every fancy
// shape. Round brilliants and Old European cuts (round outline) use round;
// everything else — including Old Mine cushions — uses pear.
export function rapShapeGroupFor(shape: string | null, cutStyle: string | null): "ROUND" | "PEAR" {
  if (cutStyle === "OLD_EUROPEAN") return "ROUND";
  if (shape && /^\s*round/i.test(shape) && cutStyle !== "ROSE" && cutStyle !== "OLD_MINE") return "ROUND";
  return "PEAR";
}

export function parseRapCsv(rows: string[][]): { rows: RapRow[]; skipped: number; error?: string } {
  if (rows.length < 2) return { rows: [], skipped: 0, error: "The file has no data rows." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (key: keyof typeof ALIASES) => header.findIndex((h) => ALIASES[key].includes(h));
  const idx = {
    shape: col("shapeGroup"),
    clarity: col("clarity"),
    color: col("color"),
    from: col("caratFrom"),
    to: col("caratTo"),
    price: col("price"),
  };
  const missing = Object.entries(idx)
    .filter(([, i]) => i < 0)
    .map(([k]) => k);
  if (missing.length) return { rows: [], skipped: 0, error: `Missing column(s): ${missing.join(", ")}.` };

  const out: RapRow[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    if (r.every((c) => !c?.trim())) continue;
    const from = Number(r[idx.from]);
    const to = Number(r[idx.to]);
    const hundreds = Number(r[idx.price]);
    if (!r[idx.color]?.trim() || !r[idx.clarity]?.trim() || !(from >= 0) || !(to >= from) || !(hundreds > 0)) {
      skipped++;
      continue;
    }
    out.push({
      shapeGroup: shapeGroupOf(r[idx.shape] ?? ""),
      color: normaliseColor(r[idx.color]),
      clarity: normaliseClarity(r[idx.clarity]),
      caratFrom: from.toFixed(2),
      caratTo: to.toFixed(2),
      pricePerCt: (Math.round(hundreds * 100 * 100) / 100).toFixed(2),
    });
  }
  return { rows: out, skipped };
}

// Discount (negative) or premium vs the Rap list price per carat, in %.
export function vsRap(askingTotal: number | null, carat: number | null, rapPerCt: number | null): number | null {
  if (!askingTotal || !carat || !rapPerCt) return null;
  return ((askingTotal / carat / rapPerCt) - 1) * 100;
}
