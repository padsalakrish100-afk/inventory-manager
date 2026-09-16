"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function nextLotNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LOT-${year}-`;
  const existing = await prisma.lot.findMany({
    where: { lotNumber: { startsWith: prefix } },
    select: { lotNumber: true },
  });
  const usedIndexes = existing
    .map((l) => Number(l.lotNumber.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
  const next = usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// Creates a lot and immediately generates its numbered stones — the only
// inputs are where the rough came from, how heavy it is, and how many
// stones are in it. No certification, stage, or naming choices to make.
export async function createLot(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sourcePartyName = String(formData.get("sourceParty") ?? "").trim();
  const roughWeightRaw = String(formData.get("roughWeight") ?? "").trim();
  const roughWeight = roughWeightRaw ? Number(roughWeightRaw) : null;
  const stoneCount = Math.trunc(Number(formData.get("stoneCount") ?? 0));

  if (!sourcePartyName) return "Source (tender or party) is required.";
  if (roughWeight !== null && (!Number.isFinite(roughWeight) || roughWeight <= 0)) {
    return "Rough weight must be a positive number.";
  }
  if (!Number.isInteger(stoneCount) || stoneCount < 1 || stoneCount > 5000) {
    return "Number of stones must be between 1 and 5000.";
  }

  const sourceParty = await prisma.party.upsert({
    where: { name: sourcePartyName },
    update: {},
    create: { name: sourcePartyName, category: "TENDER_VENDOR" },
  });

  const lotNumber = await nextLotNumber();

  const lot = await prisma.lot.create({
    data: { lotNumber, roughWeight, sourcePartyId: sourceParty.id },
  });

  const data = Array.from({ length: stoneCount }, (_, i) => {
    const sku = `${lotNumber}-${String(i + 1).padStart(4, "0")}`;
    return { sku, name: sku, unit: "pcs", stock: 1, lotId: lot.id };
  });
  await prisma.product.createMany({ data });

  revalidatePath("/lotting");
  redirect(`/lotting/${lot.id}`);
}

// Deletes a lot entered by mistake — only allowed while none of its stones
// have ever been issued or transferred to Polish, so real manufacturing
// history can never be silently erased.
export async function deleteLot(lotId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      products: {
        include: {
          polishedStone: true,
          _count: { select: { movements: true, transactions: true, processLogs: true } },
        },
      },
    },
  });
  if (!lot) throw new Error("Lot not found.");

  const hasHistory = lot.products.some((p) => p.polishedStone || p._count.movements > 0);
  if (hasHistory) {
    throw new Error("This lot has stones with manufacturing history — can't delete it.");
  }

  const hasLegacyRecords = lot.products.some((p) => p._count.transactions > 0 || p._count.processLogs > 0);
  if (hasLegacyRecords) {
    throw new Error(
      "This lot has stones with recorded transaction history from before this app was rebuilt — can't delete it.",
    );
  }

  await prisma.product.deleteMany({ where: { lotId } });
  await prisma.lot.delete({ where: { id: lotId } });

  revalidatePath("/lotting");
  revalidatePath("/manufacturing/reports");
}

// Saves one stone's weight from the inline field on the lot detail page —
// used right after lotting to record actual per-stone weights as they're
// known, without having to wait until the stone moves through manufacturing.
export async function updateStoneWeight(productId: string, weightRaw: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const trimmed = weightRaw.trim();
  const weight = trimmed ? Number(trimmed) : null;
  if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
    return { error: "Weight must be a non-negative number." };
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { lotId: true } });
  if (!product) return { error: "Stone not found." };

  await prisma.product.update({ where: { id: productId }, data: { caratWeight: weight } });

  if (product.lotId) revalidatePath(`/lotting/${product.lotId}`);
  return {};
}
