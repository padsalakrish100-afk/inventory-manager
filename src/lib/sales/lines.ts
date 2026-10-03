import { z } from "zod";
import { zId, zMoney } from "@/lib/validation";

// Stone lines posted by the memo and invoice forms as one JSON field.
const lineSchema = z.object({
  stoneId: zId,
  amount: zMoney("Line amount"),
  memoLineId: zId.optional(),
});

export type DocLineInput = z.infer<typeof lineSchema>;

export function parseDocLines(raw: FormDataEntryValue | null): { ok: true; lines: DocLineInput[] } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { ok: false, error: "Couldn't read the stone lines — reload and try again." };
  }
  const parsed = z
    .array(lineSchema)
    .min(1, "Add at least one stone.")
    .max(200, "Up to 200 stones per document.")
    .safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lines." };
  const ids = parsed.data.map((l) => l.stoneId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "The same stone is listed twice." };
  if (parsed.data.some((l) => Number(l.amount) <= 0)) return { ok: false, error: "Every stone needs a price above zero." };
  return { ok: true, lines: parsed.data };
}
