"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { inBothCurrencies } from "@/lib/money";
import { formToObject, parseInput, zOptionalText, zRequiredText } from "@/lib/validation";
import { dateInputToStartOfDayIST } from "@/lib/dates";
import { CUT_STYLES } from "@/lib/cuts";

const pct = z.union([
  z.literal("").transform(() => null),
  z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,3})?$|^100(\.0{1,3})?$/, "Loss limit must be a percentage between 0 and 100."),
]);

const stageSchema = z.object({
  name: zRequiredText("Stage name", 60),
  sortOrder: z.coerce.number().int("Order must be a whole number.").min(0).max(10_000),
  departmentId: z.string().trim().max(64).transform((v) => (v === "" ? null : v)),
  defaultLossLimitPct: pct,
  isLabourBillable: z.boolean(),
  active: z.boolean(),
});

function readStage(formData: FormData) {
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return parseInput(stageSchema, {
    name: str("name"),
    sortOrder: str("sortOrder") || "0",
    departmentId: str("departmentId"),
    defaultLossLimitPct: str("defaultLossLimitPct"),
    isLabourBillable: raw.isLabourBillable === "on",
    active: raw.active === "on",
  });
}

function codeFromName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function createStage(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readStage(formData);
  if (!parsed.ok) return parsed.error;

  const code = codeFromName(parsed.data.name);
  if (!code) return "Stage name must contain letters or numbers.";
  if (await prisma.processStage.findUnique({ where: { code } })) return "A stage with that name already exists.";

  await prisma.$transaction(async (tx) => {
    const stage = await tx.processStage.create({ data: { code, ...parsed.data } });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "ProcessStage", entityId: stage.id, after: stage });
  });
  revalidatePath("/settings/stages");
}

export async function updateStage(
  stageId: string,
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readStage(formData);
  if (!parsed.ok) return parsed.error;

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.processStage.findUnique({ where: { id: stageId } });
    if (!before) return false;
    // The code is the stable key (and the link to the old process enum), so
    // renaming a stage only changes its display name.
    const after = await tx.processStage.update({ where: { id: stageId }, data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "ProcessStage", entityId: stageId, before, after });
    return true;
  });
  if (!found) return "Stage not found.";
  revalidatePath("/settings/stages");
  return "Saved.";
}

const departmentSchema = z.object({
  name: zRequiredText("Department name", 60),
  sortOrder: z.coerce.number().int("Order must be a whole number.").min(0).max(10_000),
  active: z.boolean(),
});

function readDepartment(formData: FormData) {
  const raw = formToObject(formData);
  return parseInput(departmentSchema, {
    name: typeof raw.name === "string" ? raw.name : "",
    sortOrder: (typeof raw.sortOrder === "string" && raw.sortOrder) || "0",
    active: raw.active === "on",
  });
}

export async function createDepartment(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readDepartment(formData);
  if (!parsed.ok) return parsed.error;
  if (await prisma.department.findUnique({ where: { name: parsed.data.name } })) {
    return "A department with that name already exists.";
  }

  await prisma.$transaction(async (tx) => {
    const dept = await tx.department.create({ data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Department", entityId: dept.id, after: dept });
  });
  revalidatePath("/settings/departments");
}

export async function updateDepartment(
  departmentId: string,
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readDepartment(formData);
  if (!parsed.ok) return parsed.error;

  const clash = await prisma.department.findFirst({
    where: { name: parsed.data.name, NOT: { id: departmentId } },
    select: { id: true },
  });
  if (clash) return "A department with that name already exists.";

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.department.findUnique({ where: { id: departmentId } });
    if (!before) return false;
    const after = await tx.department.update({ where: { id: departmentId }, data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Department", entityId: departmentId, before, after });
    return true;
  });
  if (!found) return "Department not found.";
  revalidatePath("/settings/departments");
  revalidatePath("/settings/stages");
  return "Saved.";
}

const lossLimitSchema = z.object({
  stageId: z.string().trim().min(1, "Choose a stage.").max(64),
  party: z.string().trim().min(1, "Choose the karigar.").max(200),
  allowedPct: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,3})?$|^100(\.0{1,3})?$/, "Allowed loss must be a percentage between 0 and 100."),
  effectiveFrom: z.string().trim(),
});

// A karigar-specific allowed loss for one stage, effective from a date.
// Adding a new one for the same karigar+stage supersedes the old (history
// kept, so past returns keep the limit they were checked against).
export async function addLossLimit(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(lossLimitSchema, {
    stageId: str("stageId"),
    party: str("party"),
    allowedPct: str("allowedPct"),
    effectiveFrom: str("effectiveFrom"),
  });
  if (!parsed.ok) return parsed.error;

  const [stage, party] = await Promise.all([
    prisma.processStage.findUnique({ where: { id: parsed.data.stageId } }),
    prisma.party.findUnique({ where: { name: parsed.data.party } }),
  ]);
  if (!stage) return "Stage not found.";
  if (!party) return "No party with that name — add the karigar on the Parties page first.";

  await prisma.$transaction(async (tx) => {
    const limit = await tx.lossLimit.create({
      data: {
        stageId: stage.id,
        partyId: party.id,
        allowedPct: parsed.data.allowedPct,
        effectiveFrom: dateInputToStartOfDayIST(parsed.data.effectiveFrom),
      },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "LossLimit", entityId: limit.id, after: limit });
  });
  revalidatePath("/settings/loss-limits");
}

export async function deleteLossLimit(limitId: string) {
  const viewer = await requirePermission("admin");
  await prisma.$transaction(async (tx) => {
    const before = await tx.lossLimit.findUnique({ where: { id: limitId } });
    if (!before) throw new Error("Limit not found.");
    await tx.lossLimit.delete({ where: { id: limitId } });
    await writeAudit(tx, viewer.id, { action: "DELETE", entity: "LossLimit", entityId: limitId, before });
  });
  revalidatePath("/settings/loss-limits");
}

const fxSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  usdInr: z
    .string()
    .trim()
    .regex(/^\d{1,4}(\.\d{1,4})?$/, "Rate must be a number like 88.25 (up to 4 decimals)."),
});

// Sets the USD→INR rate for a date (replacing that day's rate if any).
// Money entries copy the rate in force on their date when they're created.
export async function setExchangeRate(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(fxSchema, { date: String(formData.get("date") ?? ""), usdInr: String(formData.get("usdInr") ?? "") });
  if (!parsed.ok) return parsed.error;
  if (Number(parsed.data.usdInr) <= 0) return "Rate must be more than zero.";
  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  await prisma.$transaction(async (tx) => {
    const before = await tx.exchangeRate.findUnique({ where: { date } });
    const after = await tx.exchangeRate.upsert({
      where: { date },
      create: { date, usdInr: parsed.data.usdInr, createdById: viewer.id },
      update: { usdInr: parsed.data.usdInr, createdById: viewer.id },
    });
    await writeAudit(tx, viewer.id, {
      action: before ? "UPDATE" : "CREATE",
      entity: "ExchangeRate",
      entityId: parsed.data.date,
      before,
      after,
    });
  });
  revalidatePath("/settings/fx");
}

// Entries made before any exchange rate was entered (or migrated from the
// old app) have no rate, so they're missing from the other currency's
// totals. This fills each one with the rate in force on its own date —
// only where such a rate exists — and records what it changed.
export async function fillMissingExchangeRates(): Promise<{ info: string }> {
  const viewer = await requirePermission("admin");
  const result = await prisma.$transaction(async (tx) => {
    const rates = await tx.exchangeRate.findMany({ orderBy: { date: "asc" } });
    const rateOn = (d: Date) => {
      let found: string | null = null;
      for (const r of rates) {
        if (r.date <= d) found = r.usdInr.toString();
        else break;
      }
      return found;
    };
    let labour = 0;
    let adjustments = 0;
    let costs = 0;

    for (const l of await tx.labourEntry.findMany({ where: { fxRate: null }, select: { id: true, workDate: true } })) {
      const fx = rateOn(l.workDate);
      if (!fx) continue;
      await tx.labourEntry.update({ where: { id: l.id }, data: { fxRate: fx } });
      labour++;
    }
    for (const a of await tx.karigarAdjustment.findMany({ where: { fxRate: null }, select: { id: true, date: true } })) {
      const fx = rateOn(a.date);
      if (!fx) continue;
      await tx.karigarAdjustment.update({ where: { id: a.id }, data: { fxRate: fx } });
      adjustments++;
    }
    for (const c of await tx.costEntry.findMany({
      where: { fxRate: null, voidedAt: null },
      select: { id: true, date: true, amount: true, currency: true },
    })) {
      const fx = rateOn(c.date);
      if (!fx) continue;
      const both = inBothCurrencies(c.amount, c.currency, fx);
      await tx.costEntry.update({ where: { id: c.id }, data: { fxRate: fx, amountUsd: both.usd, amountInr: both.inr } });
      costs++;
    }
    await writeAudit(tx, viewer.id, {
      action: "BULK_UPDATE",
      entity: "ExchangeRate",
      entityId: "fill-missing",
      after: { labourEntries: labour, adjustments, costEntries: costs },
    });
    return { labour, adjustments, costs };
  }, TX_OPTIONS);

  revalidatePath("/settings/fx");
  return {
    info: `Filled ${result.labour} labour entries, ${result.adjustments} advances/deductions and ${result.costs} cost entries. Entries dated before your first rate were left as they are.`,
  };
}

const generalSchema = z.object({
  pendingAlertDays: z.coerce
    .number({ message: "Pending alert days must be a number." })
    .int("Pending alert days must be a whole number.")
    .min(1, "Pending alert days must be at least 1.")
    .max(365, "Pending alert days must be 365 or less."),
  costAllocationMethod: z.enum(["WEIGHT", "EQUAL"], { message: "Choose how shared costs are divided." }),
});

export async function updateGeneralSettings(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(generalSchema, {
    pendingAlertDays: String(formData.get("pendingAlertDays") ?? ""),
    costAllocationMethod: String(formData.get("costAllocationMethod") ?? "WEIGHT"),
  });
  if (!parsed.ok) return parsed.error;

  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.upsert({ where: { id: "singleton" }, create: {}, update: {} });
    const after = await tx.setting.update({ where: { id: "singleton" }, data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Setting", entityId: "singleton", before, after });
  });
  revalidatePath("/settings");
  return "Saved.";
}

// ─── Cut-detail attributes (antique/specialty grading fields) ───────────────

const ATTRIBUTE_TYPES = ["TEXT", "NUMBER", "SELECT", "BOOLEAN"] as const;

const attributeSchema = z
  .object({
    label: zRequiredText("Label", 60),
    cutStyle: z.enum(["", ...CUT_STYLES.map((c) => c.value)] as [string, ...string[]], { message: "Choose a cut style." }),
    options: z.array(z.string().trim().min(1).max(60)).max(40, "Up to 40 choices."),
    sortOrder: z.coerce.number().int("Order must be a whole number.").min(0).max(10_000),
    active: z.boolean(),
  })
  .transform((v) => ({ ...v, cutStyle: v.cutStyle === "" ? null : v.cutStyle }));

function readAttribute(formData: FormData) {
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return parseInput(attributeSchema, {
    label: str("label"),
    cutStyle: str("cutStyle"),
    options: [...new Set(str("options").split(",").map((o) => o.trim()).filter(Boolean))],
    sortOrder: str("sortOrder") || "0",
    active: raw.active === "on",
  });
}

export async function createAttribute(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readAttribute(formData);
  if (!parsed.ok) return parsed.error;
  const type = String(formData.get("type") ?? "");
  if (!(ATTRIBUTE_TYPES as readonly string[]).includes(type)) return "Choose a field type.";
  if (type === "SELECT" && parsed.data.options.length < 2) return "A choice list needs at least two choices, separated by commas.";

  // The key is what's stored on each stone, so it's fixed once created.
  const key = parsed.data.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  if (!key) return "Label must contain letters or numbers.";
  const clash = await prisma.attributeDefinition.findFirst({ where: { key, cutStyle: parsed.data.cutStyle } });
  if (clash) return "That cut style already has a field with this name.";

  await prisma.$transaction(async (tx) => {
    const attr = await tx.attributeDefinition.create({
      data: { ...parsed.data, key, type, options: type === "SELECT" ? parsed.data.options : [] },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "AttributeDefinition", entityId: attr.id, after: attr });
  });
  revalidatePath("/settings/attributes");
}

export async function updateAttribute(
  attributeId: string,
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = readAttribute(formData);
  if (!parsed.ok) return parsed.error;

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.attributeDefinition.findUnique({ where: { id: attributeId } });
      if (!before) throw new Error("NOT_FOUND");
      if (before.type === "SELECT" && parsed.data.options.length < 2) throw new Error("FEW_OPTIONS");
      if (before.cutStyle !== parsed.data.cutStyle) {
        const clash = await tx.attributeDefinition.findFirst({
          where: { key: before.key, cutStyle: parsed.data.cutStyle, id: { not: attributeId } },
        });
        if (clash) throw new Error("CLASH");
      }
      // Type and key stay as created so values already on stones keep their meaning.
      const after = await tx.attributeDefinition.update({
        where: { id: attributeId },
        data: { ...parsed.data, options: before.type === "SELECT" ? parsed.data.options : [] },
      });
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "AttributeDefinition", entityId: attributeId, before, after });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return "Field not found.";
    if (err instanceof Error && err.message === "FEW_OPTIONS") return "A choice list needs at least two choices.";
    if (err instanceof Error && err.message === "CLASH") return "That cut style already has a field with this name.";
    throw err;
  }
  revalidatePath("/settings/attributes");
  return "Saved.";
}

// ─── Company details and document wording (memos, invoices) ─────────────────

const companySchema = z.object({
  companyName: zRequiredText("Company name", 120),
  companyAddress: zOptionalText(500),
  companyPhone: zOptionalText(60),
  companyEmail: zOptionalText(120),
  companyTaxInfo: zOptionalText(300),
  bankDetails: zOptionalText(1000),
  memoTerms: zOptionalText(4000),
  invoiceTerms: zOptionalText(4000),
  invoiceWarranty: zOptionalText(2000),
  memoDueDays: z.coerce.number().int("Days must be a whole number.").min(1).max(365),
  invoiceDueDays: z.coerce.number().int("Days must be a whole number.").min(0).max(365),
});

export async function updateCompanySettings(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const raw = formToObject(formData);
  const input = Object.fromEntries(Object.keys(companySchema.shape).map((k) => [k, typeof raw[k] === "string" ? raw[k] : ""]));
  const parsed = parseInput(companySchema, input);
  if (!parsed.ok) return parsed.error;
  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.upsert({ where: { id: "singleton" }, create: {}, update: {} });
    const after = await tx.setting.update({ where: { id: "singleton" }, data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Setting", entityId: "singleton", before, after });
  });
  revalidatePath("/settings/company");
  return "Saved.";
}
