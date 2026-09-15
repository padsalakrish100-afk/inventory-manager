"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LotStatus, ExpenseCategory } from "@/generated/prisma/client";

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
  const description = String(formData.get("description") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ROUGH");

  if (!lotNumber) return "Lot number is required.";
  if (!(STATUSES as string[]).includes(status)) return "Invalid status.";
  if (roughWeight !== null && (!Number.isFinite(roughWeight) || roughWeight < 0)) {
    return "Rough weight must be a non-negative number.";
  }

  const existing = await prisma.lot.findUnique({ where: { lotNumber } });
  if (existing) return "A lot with that number already exists.";

  let lotId: string;
  try {
    const lot = await prisma.lot.create({
      data: { lotNumber, roughWeight, description, status: status as LotStatus },
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
  const description = String(formData.get("description") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ROUGH");

  if (!(STATUSES as string[]).includes(status)) return "Invalid status.";
  if (roughWeight !== null && (!Number.isFinite(roughWeight) || roughWeight < 0)) {
    return "Rough weight must be a non-negative number.";
  }

  await prisma.lot.update({
    where: { id: lotId },
    data: { roughWeight, description, status: status as LotStatus },
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
