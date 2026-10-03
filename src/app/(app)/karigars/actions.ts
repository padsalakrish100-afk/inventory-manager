"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdjustmentType, ProcessName, RateBasis } from "@/generated/prisma/client";
import { can, ForbiddenError, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { categoryForRoles } from "@/lib/party";
import { saveAttachment, validateUpload } from "@/lib/storage";
import { usdInrOn } from "@/lib/fx";
import { propagateSplitCosts } from "@/lib/costing/allocate";
import { dateInputToInstant, dateInputToStartOfDayIST } from "@/lib/dates";
import { periodBounds, unpaidPayroll, rupees } from "@/lib/karigar/payroll";
import { formToObject, parseInput, zDateString, zId, zMoney, zOptionalText, zRequiredText } from "@/lib/validation";

async function requireCostManager() {
  const viewer = await requirePermission("karigars.manage");
  if (!can(viewer, "costs.view")) throw new ForbiddenError("Only people who can see costs can do this.");
  return viewer;
}

const profileSchema = z.object({
  phone: zOptionalText(50),
  employeeCode: zOptionalText(30),
  joiningDate: zDateString("Joining date"),
  notes: zOptionalText(1000),
  departmentIds: z.array(zId).max(30),
});

function readProfile(formData: FormData) {
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return parseInput(profileSchema, {
    phone: str("phone"),
    employeeCode: str("employeeCode"),
    joiningDate: str("joiningDate"),
    notes: str("notes"),
    departmentIds: Array.isArray(raw["departmentIds[]"]) ? raw["departmentIds[]"] : [],
  });
}

export async function createKarigar(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("karigars.manage");
  const nameParsed = parseInput(zRequiredText("Name"), String(formData.get("name") ?? ""));
  if (!nameParsed.ok) return nameParsed.error;
  const parsed = readProfile(formData);
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;

  if (await prisma.party.findUnique({ where: { name: nameParsed.data } })) {
    return "A party with that name already exists — open it under Settings → Parties and add the Karigar role.";
  }
  if (d.employeeCode && (await prisma.karigarProfile.findUnique({ where: { employeeCode: d.employeeCode } }))) {
    return "That employee code is already used.";
  }

  const id = await prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: { name: nameParsed.data, phone: d.phone, roles: ["KARIGAR"], category: categoryForRoles(["KARIGAR"], null) },
    });
    const profile = await tx.karigarProfile.create({
      data: {
        partyId: party.id,
        employeeCode: d.employeeCode,
        joiningDate: d.joiningDate ? dateInputToStartOfDayIST(d.joiningDate) : null,
        notes: d.notes,
      },
    });
    if (d.departmentIds.length) {
      await tx.karigarDepartment.createMany({ data: d.departmentIds.map((departmentId) => ({ partyId: party.id, departmentId })) });
    }
    await writeAudit(tx, viewer.id, [
      { action: "CREATE", entity: "Party", entityId: party.id, after: party },
      { action: "CREATE", entity: "KarigarProfile", entityId: party.id, after: { ...profile, departmentIds: d.departmentIds } },
    ]);
    return party.id;
  });

  revalidatePath("/karigars");
  redirect(`/karigars/${id}`);
}

export async function updateKarigar(
  partyId: string,
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("karigars.manage");
  const parsed = readProfile(formData);
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  const active = formData.get("active") === "on";

  const photo = formData.get("photo");
  const thumb = formData.get("photoThumb");
  const photoFile = photo instanceof File && photo.size > 0 ? photo : null;
  const thumbFile = thumb instanceof File && thumb.size > 0 ? thumb : null;
  if (photoFile) {
    const problem = validateUpload(photoFile, "image") ?? (thumbFile ? validateUpload(thumbFile, "image") : null);
    if (problem) return problem;
  }

  const clash = d.employeeCode
    ? await prisma.karigarProfile.findFirst({ where: { employeeCode: d.employeeCode, NOT: { partyId } } })
    : null;
  if (clash) return "That employee code is already used.";

  await prisma.$transaction(async (tx) => {
    const party = await tx.party.findUniqueOrThrow({ where: { id: partyId }, include: { karigarProfile: true, karigarDepartments: true } });
    const { karigarProfile: profileBefore, karigarDepartments, ...partyBefore } = party;

    const partyAfter = await tx.party.update({ where: { id: partyId }, data: { phone: d.phone, active } });
    const profileAfter = await tx.karigarProfile.upsert({
      where: { partyId },
      create: {
        partyId,
        employeeCode: d.employeeCode,
        joiningDate: d.joiningDate ? dateInputToStartOfDayIST(d.joiningDate) : null,
        notes: d.notes,
      },
      update: {
        employeeCode: d.employeeCode,
        joiningDate: d.joiningDate ? dateInputToStartOfDayIST(d.joiningDate) : null,
        notes: d.notes,
      },
    });
    await tx.karigarDepartment.deleteMany({ where: { partyId } });
    if (d.departmentIds.length) {
      await tx.karigarDepartment.createMany({ data: d.departmentIds.map((departmentId) => ({ partyId, departmentId })) });
    }

    if (photoFile) {
      await tx.attachment.updateMany({
        where: { entityType: "KARIGAR_PHOTO", entityId: partyId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await saveAttachment(tx, {
        entityType: "KARIGAR_PHOTO",
        entityId: partyId,
        kind: "PHOTO",
        file: photoFile,
        thumb: thumbFile,
        uploadedById: viewer.id,
      });
    }

    await writeAudit(tx, viewer.id, [
      { action: "UPDATE", entity: "Party", entityId: partyId, before: partyBefore, after: partyAfter },
      {
        action: "UPDATE",
        entity: "KarigarProfile",
        entityId: partyId,
        before: { ...profileBefore, departmentIds: karigarDepartments.map((k) => k.departmentId).sort() },
        after: { ...profileAfter, departmentIds: [...d.departmentIds].sort(), ...(photoFile ? { photo: "replaced" } : {}) },
      },
    ]);
  }, TX_OPTIONS);

  revalidatePath(`/karigars/${partyId}`);
  revalidatePath("/karigars");
  return "Saved.";
}

const rateSchema = z.object({
  partyId: z.string().trim().max(64).transform((v) => (v === "" ? null : v)),
  stageId: z.string().trim().min(1, "Choose a stage.").max(64),
  basis: z.enum(["PER_CARAT", "PER_PIECE", "FIXED"], { message: "Choose how the rate is charged." }),
  rate: zMoney("Rate"),
  effectiveFrom: zDateString("Effective-from date"),
});

// Adds a rate card row. A new row for the same karigar+stage (or stage
// default) supersedes the old from its effective date; history is kept so
// labour already calculated never changes.
export async function addRateCard(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requireCostManager();
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(rateSchema, {
    partyId: str("partyId"),
    stageId: str("stageId"),
    basis: str("basis"),
    rate: str("rate"),
    effectiveFrom: str("effectiveFrom"),
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.rate) <= 0) return "Rate must be more than zero.";

  const stage = await prisma.processStage.findUnique({ where: { id: d.stageId } });
  if (!stage) return "Stage not found.";

  await prisma.$transaction(async (tx) => {
    const row = await tx.processRate.create({
      data: {
        partyId: d.partyId,
        processStageId: stage.id,
        process: (stage.legacyProcess as ProcessName | null) ?? null,
        basis: d.basis as RateBasis,
        rate: d.rate,
        currency: "INR",
        ratePerCarat: d.basis === "PER_CARAT" ? Number(d.rate) : null,
        effectiveFrom: d.effectiveFrom ? dateInputToStartOfDayIST(d.effectiveFrom) : new Date(),
        createdById: viewer.id,
      },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "ProcessRate", entityId: row.id, after: row });
  });

  revalidatePath("/karigars/rates");
  if (d.partyId) revalidatePath(`/karigars/${d.partyId}`);
}

// Removes a rate entered by mistake — only if no labour was ever priced
// from it (otherwise add a new rate instead).
export async function deleteRateCard(rateId: string): Promise<{ error?: string }> {
  const viewer = await requireCostManager();
  try {
    const partyId = await prisma.$transaction(async (tx) => {
      const rate = await tx.processRate.findUnique({ where: { id: rateId }, include: { _count: { select: { labourEntries: true } } } });
      if (!rate) throw new UserError("Rate not found.");
      if (rate._count.labourEntries > 0) throw new UserError("Labour has been priced from this rate — add a new rate instead.");
      const { _count, ...before } = rate;
      await tx.processRate.delete({ where: { id: rateId } });
      await writeAudit(tx, viewer.id, { action: "DELETE", entity: "ProcessRate", entityId: rateId, before });
      return rate.partyId;
    });
    revalidatePath("/karigars/rates");
    if (partyId) revalidatePath(`/karigars/${partyId}`);
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

const adjustLabourSchema = z.object({
  entryId: zId,
  amount: zMoney("Amount"),
  note: z.string().trim().min(3, "Say why the amount is being changed.").max(300),
});

// Corrects one labour entry's amount (e.g. a special rate agreed for a
// difficult stone). Not allowed once paid.
export async function adjustLabourEntry(entryId: string, amount: string, note: string): Promise<{ error?: string }> {
  const viewer = await requireCostManager();
  const parsed = parseInput(adjustLabourSchema, { entryId, amount, note });
  if (!parsed.ok) return { error: parsed.error };
  try {
    const partyId = await prisma.$transaction(async (tx) => {
      const before = await tx.labourEntry.findUnique({ where: { id: entryId } });
      if (!before || before.voidedAt) throw new UserError("Labour entry not found.");
      if (before.payrollRunId) throw new UserError("Already paid in payroll — can't change it.");
      const after = await tx.labourEntry.update({
        where: { id: entryId },
        data: { amount: parsed.data.amount, source: "ADJUSTED", note: parsed.data.note },
      });
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "LabourEntry", entityId: entryId, before, after });
      // If that stone was split since, its children carry this labour too.
      const movement = await tx.processMovement.findUniqueOrThrow({ where: { id: before.movementId }, select: { productId: true } });
      await propagateSplitCosts(tx, viewer.id, movement.productId);
      return before.partyId;
    });
    revalidatePath(`/karigars/${partyId}`);
    revalidatePath("/karigars/payroll");
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

const adjustmentSchema = z.object({
  party: zRequiredText("Karigar"),
  date: zDateString(),
  type: z.enum(["ADVANCE", "DEDUCTION", "BONUS"], { message: "Choose advance, deduction, or bonus." }),
  amount: zMoney("Amount"),
  note: zOptionalText(300),
});

export async function addAdjustment(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requireCostManager();
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const parsed = parseInput(adjustmentSchema, {
    party: str("party"),
    date: str("date"),
    type: str("type"),
    amount: str("amount"),
    note: str("note"),
  });
  if (!parsed.ok) return parsed.error;
  const d = parsed.data;
  if (Number(d.amount) <= 0) return "Amount must be more than zero.";

  const party = await prisma.party.findUnique({ where: { name: d.party } });
  if (!party || !party.roles.includes("KARIGAR")) return "No karigar with that name.";
  const date = dateInputToInstant(d.date);

  await prisma.$transaction(async (tx) => {
    const adj = await tx.karigarAdjustment.create({
      data: {
        partyId: party.id,
        date,
        type: d.type as AdjustmentType,
        amount: d.amount,
        currency: "INR",
        fxRate: await usdInrOn(tx, date),
        note: d.note,
        createdById: viewer.id,
      },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "KarigarAdjustment", entityId: adj.id, after: adj });
  });

  revalidatePath("/karigars/payroll");
  revalidatePath(`/karigars/${party.id}`);
}

export async function voidAdjustment(adjustmentId: string): Promise<{ error?: string }> {
  const viewer = await requireCostManager();
  try {
    const partyId = await prisma.$transaction(async (tx) => {
      const before = await tx.karigarAdjustment.findUnique({ where: { id: adjustmentId } });
      if (!before || before.voidedAt) throw new UserError("Not found.");
      if (before.payrollRunId) throw new UserError("Already settled in payroll — can't remove it.");
      const after = await tx.karigarAdjustment.update({ where: { id: adjustmentId }, data: { voidedAt: new Date() } });
      await writeAudit(tx, viewer.id, { action: "VOID", entity: "KarigarAdjustment", entityId: adjustmentId, before, after });
      return before.partyId;
    });
    revalidatePath("/karigars/payroll");
    revalidatePath(`/karigars/${partyId}`);
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

const paySchema = z.object({
  partyId: zId,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid period."),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid period."),
  paymentMode: zOptionalText(50),
  paymentRef: zOptionalText(100),
  expectedNet: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
});

// Settles a karigar's unpaid labour and adjustments for the period as one
// payroll run, marked paid. Refuses if the numbers changed since the page
// was shown (someone returned stones in the meantime).
export async function payKarigar(input: {
  partyId: string;
  from: string;
  to: string;
  paymentMode: string;
  paymentRef: string;
  expectedNet: string;
}): Promise<{ error?: string }> {
  const viewer = await requireCostManager();
  const parsed = parseInput(paySchema, input);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;
  if (d.from > d.to) return { error: "The period's start is after its end." };
  const { start, end } = periodBounds(d.from, d.to);

  try {
    await prisma.$transaction(async (tx) => {
      const [line] = await unpaidPayroll(tx, start, end, d.partyId);
      if (!line) throw new UserError("Nothing unpaid for this karigar in the period.");
      if (rupees(line.net) !== Number(d.expectedNet).toFixed(2)) {
        throw new UserError("The amounts changed since this page loaded — refresh and check before paying.");
      }

      const run = await tx.payrollRun.create({
        data: {
          partyId: d.partyId,
          periodFrom: start,
          periodTo: new Date(end.getTime() - 1),
          labourTotal: rupees(line.labour),
          bonusTotal: rupees(line.bonus),
          deductionTotal: rupees(line.deduction),
          advanceTotal: rupees(line.advance),
          net: rupees(line.net),
          currency: "INR",
          fxRate: await usdInrOn(tx, new Date()),
          paidAt: new Date(),
          paymentMode: d.paymentMode,
          paymentRef: d.paymentRef,
          createdById: viewer.id,
        },
      });
      const linkedEntries = await tx.labourEntry.updateMany({
        where: { partyId: d.partyId, voidedAt: null, payrollRunId: null, workDate: { gte: start, lt: end } },
        data: { payrollRunId: run.id },
      });
      const linkedAdjustments = await tx.karigarAdjustment.updateMany({
        where: { partyId: d.partyId, voidedAt: null, payrollRunId: null, date: { gte: start, lt: end } },
        data: { payrollRunId: run.id },
      });
      await writeAudit(tx, viewer.id, {
        action: "CREATE",
        entity: "PayrollRun",
        entityId: run.id,
        after: { ...run, labourEntries: linkedEntries.count, adjustments: linkedAdjustments.count },
      });
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }

  revalidatePath("/karigars/payroll");
  revalidatePath(`/karigars/${d.partyId}`);
  return {};
}

// Admin-only: undoes a payroll run paid by mistake. Its labour and
// adjustments become unpaid again; the run itself is kept, voided.
export async function reversePayroll(runId: string, reason: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("admin");
  const parsedReason = parseInput(z.string().trim().min(3, "Give a reason.").max(300), reason);
  if (!parsedReason.ok) return { error: parsedReason.error };
  try {
    const partyId = await prisma.$transaction(async (tx) => {
      const before = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!before || before.voidedAt) throw new UserError("Payroll run not found.");
      await tx.labourEntry.updateMany({ where: { payrollRunId: runId }, data: { payrollRunId: null } });
      await tx.karigarAdjustment.updateMany({ where: { payrollRunId: runId }, data: { payrollRunId: null } });
      const after = await tx.payrollRun.update({
        where: { id: runId },
        data: { voidedAt: new Date(), voidReason: parsedReason.data },
      });
      await writeAudit(tx, viewer.id, { action: "VOID", entity: "PayrollRun", entityId: runId, before, after });
      return before.partyId;
    }, TX_OPTIONS);
    revalidatePath("/karigars/payroll");
    revalidatePath(`/karigars/${partyId}`);
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

class UserError extends Error {}
