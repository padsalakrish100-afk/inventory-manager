import { z } from "zod";

// Shared zod building blocks. Weights and money are validated as decimal
// strings (never parsed through a float) and passed to Prisma as strings,
// which stores them exactly in Decimal columns.

const trimmed = z.string().trim();

export const zOptionalText = (max = 500) =>
  trimmed.max(max).transform((v) => (v === "" ? null : v));

export const zRequiredText = (label: string, max = 200) =>
  trimmed.min(1, `${label} is required.`).max(max, `${label} is too long.`);

function decimalString(label: string, maxDecimals: number) {
  return trimmed.regex(
    new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`),
    `${label} must be a non-negative number with at most ${maxDecimals} decimals.`,
  );
}

// Carats: up to 3 decimals.
export const zCarat = (label = "Weight") => decimalString(label, 3);
export const zOptionalCarat = (label = "Weight") =>
  z.union([z.literal("").transform(() => null), zCarat(label)]);

// Money: up to 2 decimals.
export const zMoney = (label = "Amount") => decimalString(label, 2);
export const zOptionalMoney = (label = "Amount") =>
  z.union([z.literal("").transform(() => null), zMoney(label)]);

export const zCurrency = z.enum(["USD", "INR"]);

export const zId = z.string().trim().min(1).max(64);

export const zDateString = (label = "Date") =>
  trimmed.refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), `${label} is invalid.`);

// Plain object out of FormData, keeping repeated keys (checkbox groups) as
// arrays.
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = values.length > 1 || key.endsWith("[]") ? values : values[0];
  }
  return out;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

// First validation message only — forms show one clear line, not a list.
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): ParseResult<z.output<T>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Invalid input." };
}
