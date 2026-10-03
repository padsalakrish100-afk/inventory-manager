import type { Prisma } from "@/generated/prisma/client";
import { STONE_LOCATION_LABELS, STONE_LOCATION_VALUES, STONE_STATUS_LABELS, STONE_STATUS_VALUES } from "@/lib/stone/status";
import { CUT_STYLE_LABELS } from "@/lib/cuts";

// Filters for the polished stock list, shared with its Excel/PDF export so
// both always show the same stones.
export type PolishFilters = {
  q: string;
  status: string;
  location: string;
  cutStyle: string;
  shape: string;
  lab: string;
  color: string;
  clarity: string;
  ctMin: string;
  ctMax: string;
};

export const POLISH_FILTER_KEYS: (keyof PolishFilters)[] = [
  "q",
  "status",
  "location",
  "cutStyle",
  "shape",
  "lab",
  "color",
  "clarity",
  "ctMin",
  "ctMax",
];

const clean = (v: string | null | undefined, max = 60) => (v ?? "").trim().slice(0, max);
const num = (v: string) => (/^\d{1,3}(\.\d{1,3})?$/.test(v) ? Number(v) : null);

export function readPolishFilters(get: (key: string) => string | null | undefined): PolishFilters {
  const f = Object.fromEntries(POLISH_FILTER_KEYS.map((k) => [k, clean(get(k))])) as PolishFilters;
  if (!(STONE_STATUS_VALUES as readonly string[]).includes(f.status) && f.status !== "UNSOLD") f.status = "";
  if (!(STONE_LOCATION_VALUES as readonly string[]).includes(f.location)) f.location = "";
  if (num(f.ctMin) === null) f.ctMin = "";
  if (num(f.ctMax) === null) f.ctMax = "";
  return f;
}

export function polishWhere(f: PolishFilters): Prisma.PolishedStoneWhereInput {
  const and: Prisma.PolishedStoneWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { stockId: { contains: f.q, mode: "insensitive" } },
        { certNumber: { contains: f.q, mode: "insensitive" } },
        { sourceProduct: { sku: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.status === "UNSOLD") and.push({ sourceProduct: { status: { in: ["POLISHED", "AT_LAB", "IN_STOCK", "ON_MEMO", "RETURNED"] } } });
  else if (f.status) and.push({ sourceProduct: { status: f.status as (typeof STONE_STATUS_VALUES)[number] } });
  if (f.location) and.push({ sourceProduct: { stockLocation: f.location as (typeof STONE_LOCATION_VALUES)[number] } });
  if (f.cutStyle) and.push({ cutStyle: f.cutStyle });
  if (f.shape) and.push({ shape: { equals: f.shape, mode: "insensitive" } });
  if (f.lab === "NONE") and.push({ OR: [{ certLab: null }, { certLab: "" }] });
  else if (f.lab) and.push({ certLab: { equals: f.lab, mode: "insensitive" } });
  if (f.color) and.push({ color: { equals: f.color, mode: "insensitive" } });
  if (f.clarity) and.push({ clarity: { equals: f.clarity, mode: "insensitive" } });
  if (f.ctMin) and.push({ caratWeight: { gte: Number(f.ctMin) } });
  if (f.ctMax) and.push({ caratWeight: { lte: Number(f.ctMax) } });
  return and.length ? { AND: and } : {};
}

export function describePolishFilters(f: PolishFilters): string {
  const parts: string[] = [];
  if (f.status === "UNSOLD") parts.push("Unsold");
  else if (f.status) parts.push(STONE_STATUS_LABELS[f.status as keyof typeof STONE_STATUS_LABELS]);
  if (f.location) parts.push(STONE_LOCATION_LABELS[f.location as keyof typeof STONE_LOCATION_LABELS]);
  if (f.cutStyle) parts.push(CUT_STYLE_LABELS[f.cutStyle] ?? f.cutStyle);
  if (f.shape) parts.push(f.shape);
  if (f.lab) parts.push(f.lab === "NONE" ? "No certificate" : f.lab);
  if (f.color) parts.push(`Color ${f.color}`);
  if (f.clarity) parts.push(f.clarity);
  if (f.ctMin || f.ctMax) parts.push(`${f.ctMin || "0"}–${f.ctMax || "∞"} ct`);
  if (f.q) parts.push(`“${f.q}”`);
  return parts.length ? parts.join(" · ") : "All stones";
}

export function polishFilterParams(f: PolishFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of POLISH_FILTER_KEYS) if (f[k]) p.set(k, f[k]);
  return p;
}
