"use server";
import { num } from "@/lib/decimal";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { saveAttachment, validateUpload } from "@/lib/storage";
import { formToObject, parseInput, zCarat, zCurrency, zId, zOptionalMoney, zOptionalText, zRequiredText } from "@/lib/validation";

const planSchema = z.object({
  plannedShape: zRequiredText("Planned shape", 60),
  plannedCutStyle: zOptionalText(40),
  plannedWeight: zCarat("Planned weight"),
  expColor: zOptionalText(20),
  expClarity: zOptionalText(20),
  expCut: zOptionalText(30),
  expectedValue: zOptionalMoney("Expected value"),
  currency: zCurrency,
  notes: zOptionalText(2000),
  makeFinal: z.boolean(),
});

const MAX_PLAN_FILES = 6;

// Saves a new plan version for a stone (plans are never edited in place, so
// the history of what was planned is kept), with its Sarine/Galaxy files,
// images, or PDFs.
export async function savePlan(stoneId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("plans.edit");
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(planSchema, {
    plannedShape: str("plannedShape"),
    plannedCutStyle: str("plannedCutStyle"),
    plannedWeight: str("plannedWeight"),
    expColor: str("expColor"),
    expClarity: str("expClarity"),
    expCut: str("expCut"),
    expectedValue: str("expectedValue"),
    currency: str("currency") || "USD",
    notes: str("notes"),
    makeFinal: raw.makeFinal === "on",
  });
  if (!parsed.ok) return parsed.error;
  const { makeFinal, ...d } = parsed.data;
  if (Number(d.plannedWeight) <= 0) return "Planned weight must be more than zero.";

  const planFiles = formData.getAll("planFiles").filter((f): f is File => f instanceof File && f.size > 0);
  if (planFiles.length > MAX_PLAN_FILES) return `Attach at most ${MAX_PLAN_FILES} files.`;
  for (const f of planFiles) {
    const problem = validateUpload(f, "any");
    if (problem) return problem;
  }

  const stone = await prisma.product.findUnique({ where: { id: stoneId }, select: { status: true, roughWeight: true, caratWeight: true } });
  if (!stone) return "Stone not found.";
  if (!["IN_PRODUCTION", "POLISHED"].includes(stone.status)) return "Plans can only be made for a stone in production.";
  const base = stone.roughWeight !== null ? Number(stone.roughWeight) : num(stone.caratWeight);
  if (base !== null && Number(d.plannedWeight) > base) return `Planned weight is more than the stone's ${base} ct.`;

  await prisma.$transaction(async (tx) => {
    const last = await tx.stonePlan.findFirst({ where: { stoneId }, orderBy: { version: "desc" }, select: { version: true } });
    if (makeFinal) await tx.stonePlan.updateMany({ where: { stoneId, isFinal: true }, data: { isFinal: false } });
    const plan = await tx.stonePlan.create({
      data: { stoneId, version: (last?.version ?? 0) + 1, isFinal: makeFinal, ...d, createdById: viewer.id },
    });
    for (const f of planFiles) {
      await saveAttachment(tx, { entityType: "STONE_PLAN", entityId: plan.id, kind: "PLAN_FILE", file: f, uploadedById: viewer.id });
    }
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "StonePlan", entityId: plan.id, after: { ...plan, files: planFiles.length } });
  }, TX_OPTIONS);

  revalidatePath(`/stones/${stoneId}`);
  revalidatePath(`/stones/${stoneId}/plan`);
  revalidatePath("/planning");
}

export async function makePlanFinal(planId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("plans.edit");
  const parsed = parseInput(zId, planId);
  if (!parsed.ok) return { error: parsed.error };
  const plan = await prisma.stonePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found." };
  await prisma.$transaction(async (tx) => {
    await tx.stonePlan.updateMany({ where: { stoneId: plan.stoneId, isFinal: true }, data: { isFinal: false } });
    const after = await tx.stonePlan.update({ where: { id: planId }, data: { isFinal: true } });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "StonePlan", entityId: planId, before: plan, after });
  });
  revalidatePath(`/stones/${plan.stoneId}/plan`);
  revalidatePath(`/stones/${plan.stoneId}`);
  return {};
}
