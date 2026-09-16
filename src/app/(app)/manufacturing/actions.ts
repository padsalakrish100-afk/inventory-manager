"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ProcessName } from "@/generated/prisma/client";
import { PROCESS_VALUES } from "@/lib/process";

async function nextMemoNumber(): Promise<string> {
  const count = await prisma.memo.count();
  return `MEMO-${String(count + 1).padStart(5, "0")}`;
}

async function nextStockId(): Promise<string> {
  const count = await prisma.polishedStone.count();
  return `P-${String(count + 1).padStart(4, "0")}`;
}

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
  const session = await auth();
  if (!session?.user) redirect("/login");

  const process = input.process;
  const partyName = input.party.trim();
  const date = input.date ? new Date(input.date) : new Date();
  const notes = input.notes.trim() || null;
  const stoneInputs = input.stones.filter((s) => s.sku.trim());

  if (!(PROCESS_VALUES as readonly string[]).includes(process)) return { error: "Invalid process." };
  if (!partyName) return { error: "Party is required." };
  if (Number.isNaN(date.getTime())) return { error: "Invalid date." };
  if (stoneInputs.length === 0) return { error: "Scan or type at least one stone number." };

  const skus = stoneInputs.map((s) => s.sku.trim());
  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    include: {
      polishedStone: true,
      movements: { where: { returnDate: { not: null } }, select: { process: true } },
    },
  });
  const bySku = new Map(products.map((p) => [p.sku, p]));

  for (const sku of skus) {
    const product = bySku.get(sku);
    if (!product) return { error: `Stone "${sku}" not found.` };
    if (product.polishedStone) return { error: `Stone "${sku}" has already been transferred to Polish.` };
    if (product.currentProcess) return { error: `Stone "${sku}" is already out at ${product.currentProcess}.` };

    const alreadyCompletedThisProcess = product.movements.some((m) => m.process === process);
    const reissueReason = stoneInputs.find((s) => s.sku.trim() === sku)?.reissueReason.trim();
    if (alreadyCompletedThisProcess && !reissueReason) {
      return { error: `Stone "${sku}" already completed this process before — a reissue reason is required.` };
    }
  }

  const party = await prisma.party.upsert({
    where: { name: partyName },
    update: {},
    create: { name: partyName, category: "KARIGAR" },
  });

  const memoNumber = await nextMemoNumber();
  const memo = await prisma.memo.create({
    data: { memoNumber, process: process as ProcessName, date, partyId: party.id },
  });

  await prisma.$transaction([
    ...stoneInputs.map((s) => {
      const product = bySku.get(s.sku.trim())!;
      const weight = s.weight.trim() ? Number(s.weight) : product.caratWeight;
      const laborCostRaw = s.laborCost.trim();
      const laborCost = laborCostRaw ? Number(laborCostRaw) : null;
      return prisma.processMovement.create({
        data: {
          productId: product.id,
          process: process as ProcessName,
          partyId: party.id,
          issueDate: date,
          issueWeight: Number.isFinite(weight) ? weight : null,
          laborCost: laborCost !== null && Number.isFinite(laborCost) ? laborCost : null,
          reissueReason: s.reissueReason.trim() || null,
          notes,
          memoId: memo.id,
        },
      });
    }),
    ...stoneInputs.map((s) => {
      const product = bySku.get(s.sku.trim())!;
      const weightRaw = s.weight.trim();
      const parsedWeight = weightRaw ? Number(weightRaw) : undefined;
      return prisma.product.update({
        where: { id: product.id },
        data: {
          currentProcess: process as ProcessName,
          currentPartyId: party.id,
          ...(parsedWeight !== undefined && Number.isFinite(parsedWeight) ? { caratWeight: parsedWeight } : {}),
        },
      });
    }),
  ]);

  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/tracking");
  revalidatePath("/lotting");
  return { memoId: memo.id };
}

export type ReturnInput = {
  date: string;
  notes: string;
  stones: { sku: string; weight: string }[];
};

export type ReturnResult = { error?: string; returned?: number };

// Returns one or more scanned stones from whatever process they're
// currently out at — closes their open movement and frees them up to be
// issued to the next process (or transferred to Polish).
export async function returnStones(input: ReturnInput): Promise<ReturnResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const date = input.date ? new Date(input.date) : new Date();
  const notes = input.notes.trim() || null;
  const stoneInputs = input.stones.filter((s) => s.sku.trim());

  if (Number.isNaN(date.getTime())) return { error: "Invalid date." };
  if (stoneInputs.length === 0) return { error: "Scan or type at least one stone number." };

  const skus = stoneInputs.map((s) => s.sku.trim());
  const products = await prisma.product.findMany({ where: { sku: { in: skus } } });
  const bySku = new Map(products.map((p) => [p.sku, p]));

  for (const sku of skus) {
    const product = bySku.get(sku);
    if (!product) return { error: `Stone "${sku}" not found.` };
    if (!product.currentProcess) return { error: `Stone "${sku}" isn't currently issued anywhere.` };
  }

  for (const s of stoneInputs) {
    const product = bySku.get(s.sku.trim())!;
    const weight = s.weight.trim() ? Number(s.weight) : null;

    const openMovement = await prisma.processMovement.findFirst({
      where: { productId: product.id, returnDate: null },
      orderBy: { issueDate: "desc" },
    });
    if (!openMovement) continue;

    await prisma.$transaction([
      prisma.processMovement.update({
        where: { id: openMovement.id },
        data: {
          returnDate: date,
          returnWeight: Number.isFinite(weight) ? weight : null,
          notes: notes ?? openMovement.notes,
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: {
          currentProcess: null,
          currentPartyId: null,
          ...(weight !== null && Number.isFinite(weight) ? { caratWeight: weight } : {}),
        },
      }),
    ]);
  }

  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/tracking");
  revalidatePath("/lotting");
  return { returned: stoneInputs.length };
}

// Looks up a stone by its exact scanned/typed number and opens its detail
// page — used by the lookup box on the Manufacturing landing page.
export async function lookupStone(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sku = String(formData.get("sku") ?? "").trim();
  if (!sku) return undefined;

  const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
  if (!product) return `No stone matching "${sku}" found.`;

  redirect(`/manufacturing/stone/${product.id}`);
}

export async function transferToPolish(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { polishedStone: true } });
  if (!product) return "Stone not found.";
  if (product.polishedStone) return "This stone has already been transferred to Polish.";
  if (product.currentProcess) return "This stone is still issued to a process — return it first.";

  const certified = formData.get("certified") === "true";
  const certLab = String(formData.get("certLab") ?? "").trim() || null;
  const certNumber = String(formData.get("certNumber") ?? "").trim() || null;
  const shape = String(formData.get("shape") ?? "").trim() || null;
  const caratWeightRaw = String(formData.get("caratWeight") ?? "").trim();
  const caratWeight = caratWeightRaw ? Number(caratWeightRaw) : product.caratWeight;
  const color = String(formData.get("color") ?? "").trim() || null;
  const clarity = String(formData.get("clarity") ?? "").trim() || null;
  const cutGrade = String(formData.get("cutGrade") ?? "").trim() || null;
  const polishGrade = String(formData.get("polishGrade") ?? "").trim() || null;
  const symmetry = String(formData.get("symmetry") ?? "").trim() || null;
  const fluorescence = String(formData.get("fluorescence") ?? "").trim() || null;
  const measurements = String(formData.get("measurements") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (caratWeight !== null && (!Number.isFinite(caratWeight) || caratWeight < 0)) {
    return "Carat weight must be a non-negative number.";
  }

  const stockId = await nextStockId();

  const polished = await prisma.polishedStone.create({
    data: {
      stockId,
      sourceProductId: product.id,
      certified,
      certLab,
      certNumber,
      shape,
      caratWeight,
      color,
      clarity,
      cutGrade,
      polishGrade,
      symmetry,
      fluorescence,
      measurements,
      notes,
    },
  });

  revalidatePath("/manufacturing");
  revalidatePath("/polish");
  revalidatePath("/lotting");
  redirect(`/polish/${polished.id}`);
}

// Removes a mistaken issue/return entry entirely — not a "return," which
// implies the stone physically came back. If this was the stone's open
// movement (never returned), the stone goes back to "available."
export async function undoMovement(movementId: string, productId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const movement = await prisma.processMovement.findUnique({ where: { id: movementId } });
  if (!movement) throw new Error("Movement not found.");

  await prisma.processMovement.delete({ where: { id: movementId } });

  if (!movement.returnDate) {
    await prisma.product.update({
      where: { id: productId },
      data: { currentProcess: null, currentPartyId: null },
    });
  }

  const remainingOnMemo = movement.memoId
    ? await prisma.processMovement.count({ where: { memoId: movement.memoId } })
    : 1;
  if (movement.memoId && remainingOnMemo === 0) {
    await prisma.memo.delete({ where: { id: movement.memoId } });
  }

  revalidatePath(`/manufacturing/stone/${productId}`);
  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/reports");
  revalidatePath("/lotting");
}

// Deletes a stone entered by mistake (wrong count on a lot, duplicate scan,
// etc.) — only allowed if it's never been issued anywhere or transferred to
// Polish, so real manufacturing history can never be silently erased.
export async function deleteStone(productId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { polishedStone: true, _count: { select: { movements: true } } },
  });
  if (!product) throw new Error("Stone not found.");
  if (product.polishedStone) throw new Error("This stone has already been transferred to Polish — can't delete it.");
  if (product._count.movements > 0) throw new Error("This stone has movement history — can't delete it.");

  const lotId = product.lotId;
  await prisma.product.delete({ where: { id: productId } });

  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/reports");
  if (lotId) revalidatePath(`/lotting/${lotId}`);
}
