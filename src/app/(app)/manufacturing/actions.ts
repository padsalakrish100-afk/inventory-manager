"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dateInputToInstant } from "@/lib/dates";
import type { ProcessName } from "@/generated/prisma/client";
import { PROCESS_VALUES, PROCESS_LABELS } from "@/lib/process";
import { can, canWorkInDepartment, requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type AuditEntry } from "@/lib/audit";
import type { StoneEventInput } from "@/lib/stone/events";
import { nextMemoNumber, nextStockId } from "@/lib/counter";
import { recordStoneEvents } from "@/lib/stone/events";
import { parseScannedCode } from "@/lib/stone/scan";
import { getStages, stageForProcess } from "@/lib/process-stages";
import { ensurePartyWithRole } from "@/lib/party";
import { parseInput, zDateString, zOptionalCarat, zOptionalMoney, zOptionalText, zRequiredText } from "@/lib/validation";

function revalidateManufacturing(stoneIds: string[] = []) {
  revalidatePath("/manufacturing");
  revalidatePath("/lotting");
  revalidatePath("/stones");
  for (const id of stoneIds) revalidatePath(`/stones/${id}`);
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

const issueSchema = z.object({
  process: z.enum(PROCESS_VALUES, { message: "Invalid process." }),
  party: zRequiredText("Party"),
  date: zDateString(),
  notes: zOptionalText(1000),
  stones: z
    .array(
      z.object({
        sku: z.string().trim().max(100),
        weight: zOptionalCarat("Issue weight"),
        laborCost: zOptionalMoney("Labor cost"),
        reissueReason: zOptionalText(500),
      }),
    )
    .transform((rows) => rows.filter((r) => r.sku !== ""))
    .pipe(z.array(z.any()).min(1, "Scan or type at least one stone number.").max(500, "Issue at most 500 stones at once.")),
});

export type IssueInput = {
  process: string;
  party: string;
  date: string;
  notes: string;
  stones: { sku: string; weight: string; laborCost: string; reissueReason: string }[];
};

export type IssueResult = { error?: string; memoId?: string };

// Issues one or more scanned stones to a process/party in one go, and
// prints a single memo (with every stone's number and weight) for that
// party to sign as acknowledgment.
export async function issueStones(input: IssueInput): Promise<IssueResult> {
  const viewer = await requirePermission("mfg.issueReturn");

  const parsed = parseInput(issueSchema, {
    ...input,
    stones: input.stones.map((s) => ({ ...s, sku: parseScannedCode(s.sku) })),
  });
  if (!parsed.ok) return { error: parsed.error };
  const { process, party: partyName, notes } = parsed.data;
  const stoneInputs = parsed.data.stones as {
    sku: string;
    weight: string | null;
    laborCost: string | null;
    reissueReason: string | null;
  }[];
  const date = dateInputToInstant(parsed.data.date);

  const stage = await stageForProcess(process);
  if (!canWorkInDepartment(viewer, stage?.departmentId)) {
    return { error: `You can only issue stones for your own department's processes.` };
  }

  const skus = stoneInputs.map((s) => s.sku);
  if (new Set(skus).size !== skus.length) return { error: "The same stone is listed twice." };

  // Labour cost: people who can see costs may type/override it; for everyone
  // else it's always worked out here from the karigar's rate card.
  const canEditLabour = can(viewer, "costs.view");

  try {
    const memoId = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { sku: { in: skus } },
        include: {
          polishedStone: { select: { id: true } },
          movements: { where: { returnDate: { not: null } }, select: { process: true } },
        },
      });
      const bySku = new Map(products.map((p) => [p.sku, p]));

      for (const s of stoneInputs) {
        const product = bySku.get(s.sku);
        if (!product) throw new UserError(`Stone "${s.sku}" not found.`);
        if (product.polishedStone) throw new UserError(`Stone "${s.sku}" has already been transferred to Polish.`);
        if (product.currentProcess) {
          throw new UserError(`Stone "${s.sku}" is already out at ${PROCESS_LABELS[product.currentProcess]}.`);
        }
        if (product.status !== "IN_PRODUCTION") throw new UserError(`Stone "${s.sku}" is not in production.`);
        const alreadyCompleted = product.movements.some((m) => m.process === process);
        if (alreadyCompleted && !s.reissueReason) {
          throw new UserError(`Stone "${s.sku}" already completed this process before — a reissue reason is required.`);
        }
      }

      const party = await ensurePartyWithRole(tx, viewer.id, partyName, "KARIGAR");

      const rate = await tx.processRate.findFirst({
        where: { partyId: party.id, process: process as ProcessName, effectiveFrom: { lte: date } },
        orderBy: { effectiveFrom: "desc" },
      });

      const memo = await tx.memo.create({
        data: { memoNumber: await nextMemoNumber(tx), process: process as ProcessName, date, partyId: party.id },
      });

      const audits: AuditEntry[] = [{ action: "CREATE", entity: "Memo", entityId: memo.id, after: memo }];
      const events: StoneEventInput[] = [];

      for (const s of stoneInputs) {
        const product = bySku.get(s.sku)!;
        const weight = s.weight !== null ? Number(s.weight) : product.caratWeight;
        const autoLabour = rate && weight ? Math.round(rate.ratePerCarat * weight * 100) / 100 : null;
        const laborCost = canEditLabour ? toNumber(s.laborCost) : autoLabour;

        const movement = await tx.processMovement.create({
          data: {
            productId: product.id,
            process: process as ProcessName,
            partyId: party.id,
            issueDate: date,
            issueWeight: weight,
            laborCost,
            reissueReason: s.reissueReason,
            notes,
            memoId: memo.id,
          },
        });

        const updated = await tx.product.update({
          where: { id: product.id },
          data: {
            currentProcess: process as ProcessName,
            currentPartyId: party.id,
            currentStageId: stage?.id ?? null,
            currentDepartmentId: stage?.departmentId ?? null,
            ...(s.weight !== null ? { caratWeight: Number(s.weight) } : {}),
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
          partyId: party.id,
          weightBefore: weight,
          refType: "ProcessMovement",
          refId: movement.id,
          summary: `Issued to ${stage?.name ?? PROCESS_LABELS[process]} — ${party.name}`,
          data: { process, memoNumber: memo.memoNumber, ...(s.reissueReason ? { reissueReason: s.reissueReason } : {}) },
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
        weight: zOptionalCarat("Return weight"),
        topsWeight: zOptionalCarat("Tops weight").optional(),
      }),
    )
    .transform((rows) => rows.filter((r) => r.sku !== ""))
    .pipe(z.array(z.any()).min(1, "Scan or type at least one stone number.").max(500, "Return at most 500 stones at once.")),
});

export type ReturnInput = {
  date: string;
  notes: string;
  stones: { sku: string; weight: string; topsWeight?: string }[];
};

export type ReturnResult = { error?: string; returned?: number };

// Returns one or more scanned stones from whatever process they're
// currently out at — closes their open movement and frees them up to be
// issued to the next process (or transferred to Polish).
export async function returnStones(input: ReturnInput): Promise<ReturnResult> {
  const viewer = await requirePermission("mfg.issueReturn");

  const parsed = parseInput(returnSchema, {
    ...input,
    stones: input.stones.map((s) => ({ ...s, sku: parseScannedCode(s.sku), topsWeight: s.topsWeight ?? "" })),
  });
  if (!parsed.ok) return { error: parsed.error };
  const notes = parsed.data.notes;
  const date = dateInputToInstant(parsed.data.date);
  const stoneInputs = parsed.data.stones as { sku: string; weight: string | null; topsWeight?: string | null }[];
  const skus = stoneInputs.map((s) => s.sku);
  if (new Set(skus).size !== skus.length) return { error: "The same stone is listed twice." };

  const stages = await getStages();

  try {
    const returnedIds = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { sku: { in: skus } } });
      const bySku = new Map(products.map((p) => [p.sku, p]));

      for (const sku of skus) {
        const product = bySku.get(sku);
        if (!product) throw new UserError(`Stone "${sku}" not found.`);
        if (!product.currentProcess) throw new UserError(`Stone "${sku}" isn't currently issued anywhere.`);
        const stage =
          stages.find((s) => s.id === product.currentStageId) ??
          stages.find((s) => s.legacyProcess === product.currentProcess);
        if (!canWorkInDepartment(viewer, stage?.departmentId)) {
          throw new UserError(`Stone "${sku}" is in another department — you can't return it.`);
        }
      }

      const audits: AuditEntry[] = [];
      const events: StoneEventInput[] = [];
      const ids: string[] = [];

      for (const s of stoneInputs) {
        const product = bySku.get(s.sku)!;
        const weight = toNumber(s.weight);
        const topsWeight = toNumber(s.topsWeight ?? null);

        const openMovement = await tx.processMovement.findFirst({
          where: { productId: product.id, returnDate: null },
          orderBy: { issueDate: "desc" },
          include: { party: { select: { name: true } } },
        });
        if (!openMovement) continue;

        const { party: movementParty, ...movementBefore } = openMovement;
        const movement = await tx.processMovement.update({
          where: { id: openMovement.id },
          data: {
            returnDate: date,
            returnWeight: weight,
            topsWeight,
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
            ...(weight !== null ? { caratWeight: weight } : {}),
          },
        });

        const stageName =
          stages.find((st) => st.legacyProcess === openMovement.process)?.name ?? PROCESS_LABELS[openMovement.process];
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
          weightBefore: openMovement.issueWeight,
          weightAfter: weight,
          refType: "ProcessMovement",
          refId: movement.id,
          summary: `Returned from ${stageName}${movementParty ? ` — ${movementParty.name}` : ""}`,
          data: { process: openMovement.process, ...(topsWeight !== null ? { topsWeight } : {}) },
        });
        ids.push(product.id);
      }

      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
      return ids;
    }, TX_OPTIONS);

    revalidateManufacturing(returnedIds);
    return { returned: returnedIds.length };
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

  const parsed = parseInput(transferSchema, Object.fromEntries(
    Object.keys(transferSchema.shape).map((k) => [k, String(formData.get(k) ?? "")]),
  ));
  if (!parsed.ok) return parsed.error;
  const { caratWeight, ...fields } = parsed.data;

  let polishedId: string;
  try {
    polishedId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: { polishedStone: true } });
      if (!product) throw new UserError("Stone not found.");
      if (product.polishedStone) throw new UserError("This stone has already been transferred to Polish.");
      if (product.currentProcess) throw new UserError("This stone is still issued to a process — return it first.");
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

// Removes a mistaken issue/return entry entirely — not a "return," which
// implies the stone physically came back. If this was the stone's open
// movement (never returned), the stone goes back to "available." The full
// removed record is kept in the audit log.
export async function undoMovement(movementId: string, productId: string) {
  const viewer = await requirePermission("stones.edit");

  await prisma.$transaction(async (tx) => {
    const movement = await tx.processMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.productId !== productId) throw new Error("Movement not found.");

    await tx.processMovement.delete({ where: { id: movementId } });
    const audits: AuditEntry[] = [
      { action: "DELETE", entity: "ProcessMovement", entityId: movement.id, before: movement },
    ];

    if (!movement.returnDate) {
      const before = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const after = await tx.product.update({
        where: { id: productId },
        data: { currentProcess: null, currentPartyId: null, currentStageId: null, currentDepartmentId: null },
      });
      audits.push({ action: "UPDATE", entity: "Product", entityId: productId, before, after });
    }

    if (movement.memoId && (await tx.processMovement.count({ where: { memoId: movement.memoId } })) === 0) {
      const memo = await tx.memo.delete({ where: { id: movement.memoId } });
      audits.push({ action: "DELETE", entity: "Memo", entityId: memo.id, before: memo });
    }

    // The issue/return entries for this movement leave the timeline; the
    // undo itself is recorded in their place.
    await tx.stoneEvent.deleteMany({ where: { refType: "ProcessMovement", refId: movement.id } });
    await recordStoneEvents(tx, [
      {
        stoneId: productId,
        type: "UNDO",
        userId: viewer.id,
        partyId: movement.partyId,
        refType: "ProcessMovement",
        refId: movement.id,
        summary: `Undid ${PROCESS_LABELS[movement.process]} entry (issued ${movement.issueDate.toISOString().slice(0, 10)})`,
      },
    ]);
    await writeAudit(tx, viewer.id, audits);
  }, TX_OPTIONS);

  revalidateManufacturing([productId]);
  revalidatePath("/manufacturing/reports");
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
        _count: { select: { movements: true, transactions: true, processLogs: true, children: true } },
      },
    });
    if (!product) throw new Error("Stone not found.");
    if (product.polishedStone) throw new Error("This stone has already been transferred to Polish — can't delete it.");
    if (product._count.movements > 0) throw new Error("This stone has movement history — can't delete it.");
    if (product._count.children > 0) throw new Error("This stone has been split — can't delete it.");
    if (product._count.transactions > 0 || product._count.processLogs > 0) {
      throw new Error(
        "This stone has recorded transaction history from before this app was rebuilt — can't delete it.",
      );
    }

    const { polishedStone: _ps, _count, ...before } = product;
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
