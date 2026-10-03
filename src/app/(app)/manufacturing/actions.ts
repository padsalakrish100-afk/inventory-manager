"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dateInputToInstant } from "@/lib/dates";
import type { ProcessName } from "@/generated/prisma/client";
import { canWorkInDepartment, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type AuditEntry } from "@/lib/audit";
import { nextMemoNumber, nextStockId } from "@/lib/counter";
import { recordStoneEvents, type StoneEventInput } from "@/lib/stone/events";
import { parseScannedCode } from "@/lib/stone/scan";
import { getStages } from "@/lib/process-stages";
import { ensurePartyWithRole } from "@/lib/party";
import { computeLoss, isOverLimit } from "@/lib/manufacturing/loss";
import { resolveLossLimit } from "@/lib/manufacturing/limits";
import { RETURN_CONDITIONS } from "@/lib/manufacturing/conditions";
import { createLabourForReturn } from "@/lib/manufacturing/labour";
import {
  parseInput,
  zCarat,
  zDateString,
  zId,
  zOptionalCarat,
  zOptionalText,
} from "@/lib/validation";

function revalidateManufacturing(stoneIds: string[] = []) {
  revalidatePath("/manufacturing");
  revalidatePath("/lotting");
  revalidatePath("/stones");
  for (const id of stoneIds) revalidatePath(`/stones/${id}`);
}

function toNumber(value: string | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

// A stone is "out" while it has an open movement — tracked on the stone as
// its current stage (and, for older records, its current process).
function isOut(p: { currentStageId: string | null; currentProcess: string | null }): boolean {
  return p.currentStageId !== null || p.currentProcess !== null;
}

const zPieces = z.coerce
  .number({ message: "Pieces must be a whole number." })
  .int("Pieces must be a whole number.")
  .min(1, "Pieces must be at least 1.")
  .max(9999, "Pieces is too large.");

const issueSchema = z
  .object({
    stageId: zId,
    target: z.enum(["KARIGAR", "DEPARTMENT"]),
    party: z.string().trim().max(200),
    toDepartmentId: z.string().trim().max(64),
    fromDepartmentId: z.string().trim().max(64).transform((v) => (v === "" ? null : v)),
    date: zDateString(),
    notes: zOptionalText(1000),
    stones: z
      .array(
        z.object({
          sku: z.string().trim().max(100),
          weight: zOptionalCarat("Issue weight"),
          pieces: zPieces,
          reissueReason: zOptionalText(500),
        }),
      )
      .transform((rows) => rows.filter((r) => r.sku !== ""))
      .refine((rows) => rows.length > 0, "Scan or type at least one stone number.")
      .refine((rows) => rows.length <= 500, "Issue at most 500 stones at once."),
  })
  .refine((d) => d.target !== "KARIGAR" || d.party !== "", { message: "Choose the karigar." })
  .refine((d) => d.target !== "DEPARTMENT" || d.toDepartmentId !== "", { message: "Choose the department." });

export type IssueInput = {
  stageId: string;
  target: "KARIGAR" | "DEPARTMENT";
  party: string;
  toDepartmentId: string;
  fromDepartmentId: string;
  date: string;
  notes: string;
  stones: { sku: string; weight: string; pieces: string; reissueReason: string }[];
};

export type IssueResult = { error?: string; memoId?: string };

// Issues one or more scanned stones to a stage — with a karigar, or to a
// department — and prints a single memo listing every stone and weight.
export async function issueStones(input: IssueInput): Promise<IssueResult> {
  const viewer = await requirePermission("mfg.issueReturn");

  const parsed = parseInput(issueSchema, {
    ...input,
    stones: input.stones.map((s) => ({ ...s, sku: parseScannedCode(s.sku), pieces: s.pieces || "1" })),
  });
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;
  const date = dateInputToInstant(d.date);

  const stages = await getStages();
  const stage = stages.find((s) => s.id === d.stageId);
  if (!stage || !stage.active) return { error: "Choose an active process stage." };
  if (!canWorkInDepartment(viewer, stage.departmentId)) {
    return { error: "You can only issue stones for your own department's stages." };
  }

  const skus = d.stones.map((s) => s.sku);
  if (new Set(skus).size !== skus.length) return { error: "The same stone is listed twice." };

  try {
    const memoId = await prisma.$transaction(async (tx) => {
      if (d.toDepartmentId && d.target === "DEPARTMENT") {
        const dept = await tx.department.findUnique({ where: { id: d.toDepartmentId } });
        if (!dept || !dept.active) throw new UserError("Choose an active department.");
      }

      const products = await tx.product.findMany({
        where: { sku: { in: skus } },
        include: {
          polishedStone: { select: { id: true } },
          movements: {
            where: { returnDate: { not: null }, voidedAt: null },
            select: { stageId: true, process: true },
          },
        },
      });
      const bySku = new Map(products.map((p) => [p.sku, p]));

      for (const s of d.stones) {
        const product = bySku.get(s.sku);
        if (!product) throw new UserError(`Stone "${s.sku}" not found.`);
        if (product.polishedStone) throw new UserError(`Stone "${s.sku}" has already been transferred to Polish.`);
        if (isOut(product)) throw new UserError(`Stone "${s.sku}" is already out — return it first.`);
        if (product.status !== "IN_PRODUCTION") throw new UserError(`Stone "${s.sku}" is not in production.`);
        if (s.weight === null && product.caratWeight === null) {
          throw new UserError(`Stone "${s.sku}" has no weight recorded — enter its issue weight.`);
        }
        const alreadyCompleted = product.movements.some(
          (m) => m.stageId === stage.id || (stage.legacyProcess !== null && m.process === stage.legacyProcess),
        );
        if (alreadyCompleted && !s.reissueReason) {
          throw new UserError(`Stone "${s.sku}" already completed ${stage.name} before — a reissue reason is required.`);
        }
      }

      // An existing karigar or outside job-worker is used as-is (a job-worker
      // must not gain the Karigar role, or they'd also earn rate-card labour
      // on top of their bill); a new name is saved as a karigar.
      let party: { id: string; name: string } | null = null;
      if (d.target === "KARIGAR") {
        const existing = await tx.party.findUnique({ where: { name: d.party }, select: { id: true, name: true, roles: true } });
        party =
          existing && (existing.roles.includes("KARIGAR") || existing.roles.includes("JOB_WORKER"))
            ? existing
            : await ensurePartyWithRole(tx, viewer.id, d.party, "KARIGAR");
      }
      const toDepartmentId = d.target === "DEPARTMENT" ? d.toDepartmentId : null;
      const legacyProcess = (stage.legacyProcess as ProcessName | null) ?? null;

      const memo = await tx.memo.create({
        data: {
          memoNumber: await nextMemoNumber(tx),
          process: legacyProcess,
          stageId: stage.id,
          date,
          partyId: party?.id ?? null,
          departmentId: toDepartmentId,
        },
      });
      const targetName = party?.name ?? (await tx.department.findUnique({ where: { id: toDepartmentId! } }))?.name ?? "";

      const audits: AuditEntry[] = [{ action: "CREATE", entity: "Memo", entityId: memo.id, after: memo }];
      const events: StoneEventInput[] = [];

      for (const s of d.stones) {
        const product = bySku.get(s.sku)!;
        const weight = s.weight !== null ? Number(s.weight) : product.caratWeight!;

        const movement = await tx.processMovement.create({
          data: {
            productId: product.id,
            process: legacyProcess,
            stageId: stage.id,
            partyId: party?.id ?? null,
            toDepartmentId,
            fromDepartmentId: d.fromDepartmentId,
            issuedById: viewer.id,
            issueDate: date,
            issueWeight: weight,
            issuePieces: s.pieces,
            // Labour is priced when the stone comes back (LabourEntry).
            reissueReason: s.reissueReason,
            notes: d.notes,
            memoId: memo.id,
          },
        });

        const updated = await tx.product.update({
          where: { id: product.id },
          data: {
            currentProcess: legacyProcess,
            currentPartyId: party?.id ?? null,
            currentStageId: stage.id,
            currentDepartmentId: toDepartmentId ?? stage.departmentId,
            caratWeight: weight,
          },
        });

        const { polishedStone: _p, movements: _m, ...productBefore } = product;
        audits.push(
          { action: "CREATE", entity: "ProcessMovement", entityId: movement.id, after: movement },
          { action: "UPDATE", entity: "Product", entityId: product.id, before: productBefore, after: updated },
        );
        events.push({
          stoneId: product.id,
          type: "ISSUE",
          at: date,
          userId: viewer.id,
          partyId: party?.id ?? null,
          weightBefore: weight,
          refType: "ProcessMovement",
          refId: movement.id,
          summary: `Issued to ${stage.name} — ${targetName}`,
          data: {
            stageId: stage.id,
            memoNumber: memo.memoNumber,
            ...(s.pieces > 1 ? { pieces: s.pieces } : {}),
            ...(s.reissueReason ? { reissueReason: s.reissueReason } : {}),
          },
        });
      }

      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
      return memo.id;
    }, TX_OPTIONS);

    revalidateManufacturing();
    return { memoId };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

const returnSchema = z.object({
  date: zDateString(),
  notes: zOptionalText(1000),
  stones: z
    .array(
      z.object({
        sku: z.string().trim().max(100),
        weight: zCarat("Return weight"),
        pieces: z.union([z.literal("").transform(() => null), zPieces]),
        condition: z.enum(RETURN_CONDITIONS, { message: "Choose a condition." }),
        remark: zOptionalText(500),
        topsWeight: zOptionalCarat("Tops weight"),
        excessReason: zOptionalText(500),
      }),
    )
    .transform((rows) => rows.filter((r) => r.sku !== ""))
    .refine((rows) => rows.length > 0, "Scan or type at least one stone number.")
    .refine((rows) => rows.length <= 500, "Return at most 500 stones at once."),
});

export type ReturnInput = {
  date: string;
  notes: string;
  stones: {
    sku: string;
    weight: string;
    pieces?: string;
    condition?: string;
    remark?: string;
    topsWeight?: string;
    excessReason?: string;
  }[];
};

export type ReturnResult = { error?: string; returned?: number; excess?: number };

// Returns scanned stones from wherever they're out: closes the open
// movement, works out loss (carats and %), checks it against the allowed
// loss for that stage/karigar, and frees the stone for its next step. A
// return over the limit is flagged and needs a reason before it can be saved.
export async function returnStones(input: ReturnInput): Promise<ReturnResult> {
  const viewer = await requirePermission("mfg.issueReturn");

  const parsed = parseInput(returnSchema, {
    ...input,
    stones: input.stones.map((s) => ({
      sku: parseScannedCode(s.sku),
      weight: s.weight ?? "",
      pieces: s.pieces ?? "",
      condition: s.condition || "OK",
      remark: s.remark ?? "",
      topsWeight: s.topsWeight ?? "",
      excessReason: s.excessReason ?? "",
    })),
  });
  if (!parsed.ok) return { error: parsed.error };
  const { notes, stones } = parsed.data;
  const date = dateInputToInstant(parsed.data.date);
  const skus = stones.map((s) => s.sku);
  if (new Set(skus).size !== skus.length) return { error: "The same stone is listed twice." };

  const stages = await getStages();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { sku: { in: skus } } });
      const bySku = new Map(products.map((p) => [p.sku, p]));

      const audits: AuditEntry[] = [];
      const events: StoneEventInput[] = [];
      const ids: string[] = [];
      let excessCount = 0;

      for (const s of stones) {
        const product = bySku.get(s.sku);
        if (!product) throw new UserError(`Stone "${s.sku}" not found.`);
        if (!isOut(product)) throw new UserError(`Stone "${s.sku}" isn't currently issued anywhere.`);

        const openMovement = await tx.processMovement.findFirst({
          where: { productId: product.id, returnDate: null, voidedAt: null },
          orderBy: { issueDate: "desc" },
          include: { party: { select: { name: true } }, toDepartment: { select: { name: true } } },
        });
        if (!openMovement) throw new UserError(`Stone "${s.sku}" has no open issue entry.`);

        const stage =
          stages.find((st) => st.id === openMovement.stageId) ??
          stages.find((st) => st.legacyProcess === openMovement.process);
        if (!canWorkInDepartment(viewer, stage?.departmentId)) {
          throw new UserError(`Stone "${s.sku}" is in another department — you can't return it.`);
        }

        const issueWeight = openMovement.issueWeight;
        const loss = issueWeight !== null ? computeLoss(issueWeight, s.weight, s.topsWeight) : null;
        if (loss && Number(loss.lossWeight) < 0) {
          throw new UserError(`Stone "${s.sku}": return weight is more than the ${issueWeight} ct issued.`);
        }
        const limit = await resolveLossLimit(tx, stage?.id ?? null, openMovement.partyId, date);
        const excess = loss ? isOverLimit(loss.lossPct, limit) : false;
        if (excess && !s.excessReason) {
          throw new UserError(
            `Stone "${s.sku}": loss ${Number(loss!.lossPct).toFixed(2)}% is over the ${Number(limit).toFixed(2)}% allowed — give a reason.`,
          );
        }
        if (excess) excessCount++;

        const { party: movementParty, toDepartment, ...movementBefore } = openMovement;
        const movement = await tx.processMovement.update({
          where: { id: openMovement.id },
          data: {
            returnDate: date,
            returnWeight: Number(s.weight),
            topsWeight: toNumber(s.topsWeight),
            returnPieces: s.pieces ?? openMovement.issuePieces,
            condition: s.condition,
            returnRemark: s.remark,
            returnedById: viewer.id,
            lossWeight: loss?.lossWeight ?? null,
            lossPct: loss?.lossPct ?? null,
            lossLimitPct: limit,
            isExcessLoss: excess,
            excessReason: excess ? s.excessReason : null,
            notes: notes ?? openMovement.notes,
          },
        });
        const updated = await tx.product.update({
          where: { id: product.id },
          data: {
            currentProcess: null,
            currentPartyId: null,
            currentStageId: null,
            currentDepartmentId: null,
            caratWeight: Number(s.weight),
          },
        });

        const labour = await createLabourForReturn(
          tx,
          movement,
          stage ? { id: stage.id, isLabourBillable: stage.isLabourBillable } : null,
          date,
        );
        if (labour) audits.push({ action: "CREATE", entity: "LabourEntry", entityId: labour.id, after: labour });

        const stageName = stage?.name ?? "process";
        const from = movementParty?.name ?? toDepartment?.name;
        audits.push(
          { action: "UPDATE", entity: "ProcessMovement", entityId: movement.id, before: movementBefore, after: movement },
          { action: "UPDATE", entity: "Product", entityId: product.id, before: product, after: updated },
        );
        events.push({
          stoneId: product.id,
          type: "RETURN",
          at: date,
          userId: viewer.id,
          partyId: openMovement.partyId,
          weightBefore: issueWeight,
          weightAfter: s.weight,
          refType: "ProcessMovement",
          refId: movement.id,
          summary:
            `Returned from ${stageName}${from ? ` — ${from}` : ""}` +
            (loss?.lossPct ? ` · loss ${Number(loss.lossPct).toFixed(2)}%` : "") +
            (excess ? ` (over ${Number(limit).toFixed(2)}% limit)` : ""),
          data: {
            stageId: stage?.id ?? null,
            condition: s.condition,
            ...(s.topsWeight ? { topsWeight: s.topsWeight } : {}),
            ...(s.remark ? { note: s.remark } : {}),
            ...(excess ? { excessReason: s.excessReason } : {}),
          },
        });
        ids.push(product.id);
      }

      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
      return { ids, excessCount };
    }, TX_OPTIONS);

    revalidateManufacturing(result.ids);
    revalidatePath("/manufacturing/alerts");
    return { returned: result.ids.length, excess: result.excessCount };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

// Looks up a stone by its scanned/typed number (or polished Stock ID) and
// opens its page — used by the lookup box on the Manufacturing landing page.
export async function lookupStone(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requirePermission("stones.view");

  const code = parseScannedCode(String(formData.get("sku") ?? ""));
  if (!code) return undefined;

  const product =
    (await prisma.product.findUnique({ where: { sku: code }, select: { id: true } })) ??
    (await prisma.polishedStone.findUnique({ where: { stockId: code }, select: { sourceProductId: true } }).then(
      (p) => (p ? { id: p.sourceProductId } : null),
    ));
  if (!product) return `No stone matching "${code}" found.`;

  redirect(`/stones/${product.id}`);
}

const transferSchema = z.object({
  certified: z.string().optional().transform((v) => v === "true"),
  certLab: zOptionalText(50),
  certNumber: zOptionalText(100),
  shape: zOptionalText(100),
  caratWeight: zOptionalCarat("Carat weight"),
  color: zOptionalText(20),
  clarity: zOptionalText(20),
  cutGrade: zOptionalText(30),
  polishGrade: zOptionalText(30),
  symmetry: zOptionalText(30),
  fluorescence: zOptionalText(30),
  measurements: zOptionalText(100),
  notes: zOptionalText(2000),
});

export async function transferToPolish(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("stones.edit");

  const parsed = parseInput(
    transferSchema,
    Object.fromEntries(Object.keys(transferSchema.shape).map((k) => [k, String(formData.get(k) ?? "")])),
  );
  if (!parsed.ok) return parsed.error;
  const { caratWeight, ...fields } = parsed.data;

  let polishedId: string;
  try {
    polishedId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { polishedStone: true } });
      if (!product) throw new UserError("Stone not found.");
      if (product.polishedStone) throw new UserError("This stone has already been transferred to Polish.");
      if (isOut(product)) throw new UserError("This stone is still issued to a process — return it first.");
      if (product.status !== "IN_PRODUCTION") throw new UserError("Only a stone in production can be transferred.");

      const polished = await tx.polishedStone.create({
        data: {
          stockId: await nextStockId(tx),
          sourceProductId: product.id,
          caratWeight: caratWeight !== null ? Number(caratWeight) : product.caratWeight,
          ...fields,
        },
      });
      const { polishedStone: _ps, ...productBefore } = product;
      const updated = await tx.product.update({ where: { id: product.id }, data: { status: "POLISHED" } });

      await writeAudit(tx, viewer.id, [
        { action: "CREATE", entity: "PolishedStone", entityId: polished.id, after: polished },
        { action: "UPDATE", entity: "Product", entityId: product.id, before: productBefore, after: updated },
      ]);
      await recordStoneEvents(tx, [
        {
          stoneId: product.id,
          type: "TRANSFER_TO_POLISH",
          userId: viewer.id,
          weightBefore: product.caratWeight,
          weightAfter: polished.caratWeight,
          refType: "PolishedStone",
          refId: polished.id,
          summary: `Transferred to Polish as ${polished.stockId}`,
        },
      ]);
      return polished.id;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidateManufacturing([productId]);
  revalidatePath("/polish");
  redirect(`/polish/${polishedId}`);
}

const voidSchema = z.object({
  movementId: zId,
  reason: z.string().trim().min(3, "Give a reason for undoing this entry.").max(500),
});

// Undoes a mistaken issue/return entry. The entry is voided (kept, marked,
// with who/when/why) rather than deleted — it can carry labour cost — and
// the stone goes back to where it was before that issue. Only the stone's
// latest entry can be undone, so history always stays consistent.
export async function voidMovement(movementId: string, reason: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("stones.edit");
  const parsed = parseInput(voidSchema, { movementId, reason });
  if (!parsed.ok) return { error: parsed.error };

  try {
    const productId = await prisma.$transaction(async (tx) => {
      const movement = await tx.processMovement.findUnique({ where: { id: movementId } });
      if (!movement || movement.voidedAt) throw new UserError("Entry not found or already undone.");

      const latest = await tx.processMovement.findFirst({
        where: { productId: movement.productId, voidedAt: null },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      });
      if (latest?.id !== movement.id) throw new UserError("Only the stone's most recent entry can be undone.");

      const product = await tx.product.findUniqueOrThrow({
        where: { id: movement.productId },
        include: { polishedStone: { select: { id: true } }, _count: { select: { children: true, breakages: true } } },
      });
      if (product.polishedStone) throw new UserError("The stone is already in Polish — undo the transfer first.");
      if (product._count.children > 0) throw new UserError("The stone has been split — this entry can't be undone.");

      const labour = await tx.labourEntry.findUnique({
        where: { movementId },
        include: { payrollRun: { select: { voidedAt: true } } },
      });
      if (labour && !labour.voidedAt && labour.payrollRun && !labour.payrollRun.voidedAt) {
        throw new UserError("The labour for this entry has already been paid in payroll — reverse that payroll first.");
      }
      if (labour && !labour.voidedAt) {
        const { payrollRun: _pr, ...labourBefore } = labour;
        const labourAfter = await tx.labourEntry.update({ where: { id: labour.id }, data: { voidedAt: new Date() } });
        await writeAudit(tx, viewer.id, { action: "VOID", entity: "LabourEntry", entityId: labour.id, before: labourBefore, after: labourAfter });
      }

      const voided = await tx.processMovement.update({
        where: { id: movementId },
        data: { voidedAt: new Date(), voidedById: viewer.id, voidReason: parsed.data.reason },
      });
      // Back to how it was before this issue: in hand, at the issued weight.
      const { polishedStone: _ps, _count, ...productBefore } = product;
      const productAfter = await tx.product.update({
        where: { id: product.id },
        data: {
          currentProcess: null,
          currentPartyId: null,
          currentStageId: null,
          currentDepartmentId: null,
          ...(movement.issueWeight !== null ? { caratWeight: movement.issueWeight } : {}),
        },
      });

      await writeAudit(tx, viewer.id, [
        { action: "VOID", entity: "ProcessMovement", entityId: movement.id, before: movement, after: voided },
        { action: "UPDATE", entity: "Product", entityId: product.id, before: productBefore, after: productAfter },
      ]);
      await recordStoneEvents(tx, [
        {
          stoneId: product.id,
          type: "VOID",
          userId: viewer.id,
          partyId: movement.partyId,
          refType: "ProcessMovement",
          refId: movement.id,
          summary: `Entry undone: ${movement.returnDate ? "issue and return" : "issue"} of ${movement.issueDate.toISOString().slice(0, 10)}`,
          data: { note: parsed.data.reason },
        },
      ]);
      return product.id;
    }, TX_OPTIONS);

    revalidateManufacturing([productId]);
    revalidatePath("/manufacturing/reports");
    revalidatePath("/manufacturing/alerts");
    return {};
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

const reviewSchema = z.object({
  movementId: zId,
  note: z.string().trim().max(500),
});

// A manager/admin acknowledges an excess-loss return, clearing it from the
// open alerts list (it stays flagged in history and reports).
export async function reviewExcessLoss(movementId: string, note: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("mfg.reports");
  const parsed = parseInput(reviewSchema, { movementId, note });
  if (!parsed.ok) return { error: parsed.error };

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.processMovement.findUnique({ where: { id: movementId } });
      if (!before || !before.isExcessLoss || before.voidedAt) throw new UserError("Alert not found.");
      if (before.excessReviewedAt) throw new UserError("Already reviewed.");
      const after = await tx.processMovement.update({
        where: { id: movementId },
        data: { excessReviewedAt: new Date(), excessReviewedById: viewer.id, excessReviewNote: parsed.data.note || null },
      });
      await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "ProcessMovement", entityId: movementId, before, after });
      await recordStoneEvents(tx, [
        {
          stoneId: before.productId,
          type: "EXCESS_REVIEWED",
          userId: viewer.id,
          refType: "ProcessMovement",
          refId: movementId,
          summary: "Excess loss reviewed",
          data: parsed.data.note ? { note: parsed.data.note } : undefined,
        },
      ]);
    });
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }

  revalidatePath("/manufacturing/alerts");
  revalidatePath("/manufacturing");
  return {};
}

// Deletes a stone entered by mistake (wrong count on a lot, duplicate scan,
// etc.) — only allowed if it's never been issued anywhere or transferred to
// Polish, so real manufacturing history can never be silently erased.
export async function deleteStone(productId: string) {
  const viewer = await requirePermission("stones.edit");

  const lotId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        polishedStone: true,
        _count: {
          select: {
            movements: true,
            transactions: true,
            processLogs: true,
            children: true,
            breakages: true,
            splits: true,
            costEntries: true,
            plans: true,
          },
        },
      },
    });
    if (!product) throw new Error("Stone not found.");
    if (product.polishedStone) throw new Error("This stone has already been transferred to Polish — can't delete it.");
    if (product._count.movements > 0) throw new Error("This stone has movement history — can't delete it.");
    if (product._count.children > 0 || product._count.splits > 0) throw new Error("This stone has been split — can't delete it.");
    if (product._count.breakages > 0) throw new Error("This stone has a breakage record — can't delete it.");
    if (product._count.costEntries > 0) throw new Error("This stone has costs recorded — can't delete it.");
    if (product._count.plans > 0) throw new Error("This stone has a plan — can't delete it.");
    if (product.parentId) throw new Error("This stone came from a split — can't delete it.");
    if (product._count.transactions > 0 || product._count.processLogs > 0) {
      throw new Error(
        "This stone has recorded transaction history from before this app was rebuilt — can't delete it.",
      );
    }

    const { polishedStone: _ps, _count, ...before } = product;
    await tx.stoneEvent.deleteMany({ where: { stoneId: productId } });
    await tx.product.delete({ where: { id: productId } });
    await writeAudit(tx, viewer.id, { action: "DELETE", entity: "Product", entityId: productId, before });
    return product.lotId;
  }, TX_OPTIONS);

  revalidateManufacturing();
  revalidatePath("/manufacturing/reports");
  if (lotId) revalidatePath(`/lotting/${lotId}`);
}

// A validation failure found inside a transaction — rolled back and shown
// to the user as a form error rather than a crash.
class UserError extends Error {}
