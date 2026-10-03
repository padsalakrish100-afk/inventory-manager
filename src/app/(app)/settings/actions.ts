"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { formToObject, parseInput, zRequiredText } from "@/lib/validation";

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

const generalSchema = z.object({
  pendingAlertDays: z.coerce
    .number({ message: "Pending alert days must be a number." })
    .int("Pending alert days must be a whole number.")
    .min(1, "Pending alert days must be at least 1.")
    .max(365, "Pending alert days must be 365 or less."),
});

export async function updateGeneralSettings(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(generalSchema, { pendingAlertDays: String(formData.get("pendingAlertDays") ?? "") });
  if (!parsed.ok) return parsed.error;

  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.upsert({ where: { id: "singleton" }, create: {}, update: {} });
    const after = await tx.setting.update({ where: { id: "singleton" }, data: parsed.data });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Setting", entityId: "singleton", before, after });
  });
  revalidatePath("/settings");
  return "Saved.";
}
