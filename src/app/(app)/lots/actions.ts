"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAllocationPreview } from "@/lib/lot-allocation";
import { Prisma, type LotStatus, type ExpenseCategory } from "@/generated/prisma/client";

const STATUSES: LotStatus[] = ["ROUGH", "SAWING", "CUTTING", "POLISHING", "COMPLETED"];
const CATEGORIES: ExpenseCategory[] = [
  "ROUGH_PURCHASE",
  "SAWING",
  "CUTTING",
  "POLISHING",
  "CERTIFICATION",
  "OTHER",
];

export async function createLot(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const lotNumber = String(formData.get("lotNumber") ?? "").trim();
  const roughWeightRaw = String(formData.get("roughWeight") ?? "").trim();
  const roughWeight = roughWeightRaw ? Number(roughWeightRaw) : null;
  const polishedWeightRaw = String(formData.get("polishedWeight") ?? "").trim();
  const polishedWeight = polishedWeightRaw ? Number(polishedWeightRaw) : null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ROUGH");

  if (!lotNumber) return "Lot number is required.";
  if (!(STATUSES as string[]).includes(status)) return "Invalid status.";
  if (roughWeight !== null && (!Number.isFinite(roughWeight) || roughWeight < 0)) {
    return "Rough weight must be a non-negative number.";
  }
  if (polishedWeight !== null && (!Number.isFinite(polishedWeight) || polishedWeight < 0)) {
    return "Polished weight must be a non-negative number.";
  }

  const existing = await prisma.lot.findUnique({ where: { lotNumber } });
  if (existing) return "A lot with that number already exists.";

  let lotId: string;
  try {
    const lot = await prisma.lot.create({
      data: { lotNumber, roughWeight, polishedWeight, description, status: status as LotStatus },
    });
    lotId = lot.id;
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/lots");
  redirect(`/lots/${lotId}`);
}

export async function updateLot(
  lotId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roughWeightRaw = String(formData.get("roughWeight") ?? "").trim();
  const roughWeight = roughWeightRaw ? Number(roughWeightRaw) : null;
  const polishedWeightRaw = String(formData.get("polishedWeight") ?? "").trim();
  const polishedWeight = polishedWeightRaw ? Number(polishedWeightRaw) : null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ROUGH");

  if (!(STATUSES as string[]).includes(status)) return "Invalid status.";
  if (roughWeight !== null && (!Number.isFinite(roughWeight) || roughWeight < 0)) {
    return "Rough weight must be a non-negative number.";
  }
  if (polishedWeight !== null && (!Number.isFinite(polishedWeight) || polishedWeight < 0)) {
    return "Polished weight must be a non-negative number.";
  }

  await prisma.lot.update({
    where: { id: lotId },
    data: { roughWeight, polishedWeight, description, status: status as LotStatus },
  });

  revalidatePath("/lots");
  revalidatePath(`/lots/${lotId}`);
}

export async function deleteLot(lotId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const productCount = await prisma.product.count({ where: { lotId } });
  if (productCount > 0) {
    throw new Error("This lot has products linked to it and can't be deleted.");
  }

  await prisma.lot.delete({ where: { id: lotId } });
  revalidatePath("/lots");
}

export async function addExpense(
  lotId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const category = String(formData.get("category") ?? "OTHER");
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const dateRaw = String(formData.get("date") ?? "").trim();
  const date = dateRaw ? new Date(dateRaw) : new Date();

  if (!(CATEGORIES as string[]).includes(category)) return "Invalid category.";
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be a positive number.";
  if (Number.isNaN(date.getTime())) return "Invalid date.";

  await prisma.lotExpense.create({
    data: { lotId, category: category as ExpenseCategory, description, amount, date },
  });

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/lots");
}

export async function deleteExpense(expenseId: string, lotId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await prisma.lotExpense.delete({ where: { id: expenseId } });
  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/lots");
}

export type GenerateStonesResult = { error?: string; created?: number };

export async function generateStones(
  lotId: string,
  _prevState: GenerateStonesResult | undefined,
  formData: FormData,
): Promise<GenerateStonesResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const count = Math.trunc(Number(formData.get("count") ?? 0));
  const namePrefix = String(formData.get("namePrefix") ?? "").trim();
  const caratRaw = String(formData.get("caratWeight") ?? "").trim();
  const caratWeight = caratRaw ? Number(caratRaw) : null;
  const unit = String(formData.get("unit") ?? "pcs").trim() || "pcs";

  if (!Number.isInteger(count) || count < 1 || count > 2000) {
    return { error: "Number of stones must be between 1 and 2000." };
  }
  if (!namePrefix) return { error: "Name is required." };
  if (caratWeight !== null && (!Number.isFinite(caratWeight) || caratWeight < 0)) {
    return { error: "Carat weight must be a non-negative number." };
  }

  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) return { error: "Lot not found." };

  const existing = await prisma.product.findMany({
    where: { lotId, sku: { startsWith: `${lot.lotNumber}-` } },
    select: { sku: true },
  });
  const usedIndexes = existing
    .map((p) => Number(p.sku.slice(lot.lotNumber.length + 1)))
    .filter((n) => Number.isInteger(n));
  let nextIndex = usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : 1;

  const data = Array.from({ length: count }, () => {
    const sku = `${lot.lotNumber}-${String(nextIndex).padStart(4, "0")}`;
    nextIndex += 1;
    return {
      sku,
      name: namePrefix,
      unit,
      stock: 1,
      caratWeight,
      lotId,
    };
  });

  const result = await prisma.product.createMany({ data, skipDuplicates: true });

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { created: result.count };
}

export async function allocateExpenses(lotId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { expenses: true, products: true },
  });
  if (!lot) throw new Error("Lot not found.");

  const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
  const preview = computeAllocationPreview(totalExpense, lot.products);

  if (!preview) {
    throw new Error(
      "Nothing to allocate — link at least one SKU with stock greater than zero to this lot first.",
    );
  }

  // A single bulk UPDATE instead of one statement per row — with hundreds
  // of individually-numbered stones, per-row round trips to the database
  // reliably blow past Prisma's interactive transaction timeout.
  const values = Prisma.join(
    preview.rows.map(
      (row) => Prisma.sql`(${row.productId}::text, ${row.costPerUnit}::double precision)`,
    ),
  );
  await prisma.$executeRaw`
    UPDATE "Product" AS p
    SET "costPrice" = v.cost
    FROM (VALUES ${values}) AS v(id, cost)
    WHERE p.id = v.id
  `;

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
