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
    create: { name: sourcePartyName },
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
