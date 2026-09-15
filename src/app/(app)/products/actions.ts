"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LotStatus } from "@/generated/prisma/client";

const STAGES: LotStatus[] = ["ROUGH", "SAWING", "CUTTING", "POLISHING", "CERTIFICATION", "COMPLETED"];

function parseProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "pcs").trim() || "pcs";
  const stock = Number(formData.get("stock") ?? 0);
  const reorderLevel = Number(formData.get("reorderLevel") ?? 0);
  const location = String(formData.get("location") ?? "").trim() || null;
  const giaCertified = formData.get("giaCertified") === "true";

  const caratWeightRaw = String(formData.get("caratWeight") ?? "").trim();
  const caratWeight = caratWeightRaw ? Number(caratWeightRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const clarity = String(formData.get("clarity") ?? "").trim() || null;
  const cutGrade = String(formData.get("cutGrade") ?? "").trim() || null;

  const costPrice = Number(formData.get("costPrice") ?? 0);
  const sellingPrice = Number(formData.get("sellingPrice") ?? 0);
  const lotId = String(formData.get("lotId") ?? "").trim() || null;
  const stage = String(formData.get("stage") ?? "ROUGH");

  if (!sku || !name) {
    throw new Error("SKU and name are required.");
  }
  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error("Stock must be a non-negative number.");
  }
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new Error("Reorder level must be a non-negative number.");
  }
  if (caratWeight !== null && (!Number.isFinite(caratWeight) || caratWeight < 0)) {
    throw new Error("Carat weight must be a non-negative number.");
  }
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error("Cost price must be a non-negative number.");
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new Error("Selling price must be a non-negative number.");
  }
  if (!(STAGES as string[]).includes(stage)) {
    throw new Error("Invalid stage.");
  }

  return {
    sku,
    name,
    unit,
    stock: Math.trunc(stock),
    reorderLevel: Math.trunc(reorderLevel),
    location,
    giaCertified,
    caratWeight,
    color,
    clarity,
    cutGrade,
    costPrice,
    sellingPrice,
    lotId,
    stage: stage as LotStatus,
  };
}

export async function createProduct(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    const data = parseProductForm(formData);
    await prisma.product.create({ data });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect("/products");
}

export async function updateProduct(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    const data = parseProductForm(formData);
    await prisma.product.update({ where: { id: productId }, data });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect("/products");
}

export async function deleteProduct(productId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const transactionCount = await prisma.transaction.count({ where: { productId } });
  if (transactionCount > 0) {
    throw new Error(
      "This product has transaction history and cannot be deleted. Consider setting its stock to 0 instead.",
    );
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
