"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LotStatus, CertificationLab } from "@/generated/prisma/client";
import { STAGE_VALUES } from "@/lib/stages";
import { CERT_VALUES } from "@/lib/certification";

const STAGES = STAGE_VALUES as unknown as LotStatus[];

function parseProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "pcs").trim() || "pcs";
  const stock = Number(formData.get("stock") ?? 0);
  const reorderLevel = Number(formData.get("reorderLevel") ?? 0);
  const location = String(formData.get("location") ?? "").trim() || null;
  const certificationLab = String(formData.get("certificationLab") ?? "NONE");

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
  if (!(CERT_VALUES as readonly string[]).includes(certificationLab)) {
    throw new Error("Invalid certification.");
  }

  return {
    sku,
    name,
    unit,
    stock: Math.trunc(stock),
    reorderLevel: Math.trunc(reorderLevel),
    location,
    certificationLab: certificationLab as CertificationLab,
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

  let stage: LotStatus = "ROUGH";
  try {
    const data = parseProductForm(formData);
    stage = data.stage;
    await prisma.product.create({ data });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/manufacturing");
  revalidatePath("/polish");
  revalidatePath("/dashboard");
  redirect(stage === "COMPLETED" ? "/polish" : "/manufacturing");
}

export async function updateProduct(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let stage: LotStatus = "ROUGH";
  try {
    const data = parseProductForm(formData);
    stage = data.stage;
    await prisma.product.update({ where: { id: productId }, data });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/manufacturing");
  revalidatePath("/polish");
  revalidatePath("/dashboard");
  redirect(stage === "COMPLETED" ? "/polish" : "/manufacturing");
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
  revalidatePath("/manufacturing");
  revalidatePath("/polish");
  revalidatePath("/dashboard");
}

// Records one step a stone went through (e.g. Galaxy scanning by Party X,
// then Sawing by Party Y) and moves the product's current stage to match.
export async function addProcessLog(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const stage = String(formData.get("stage") ?? "");
  const partyName = String(formData.get("party") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!(STAGES as string[]).includes(stage)) return "Invalid stage.";
  if (Number.isNaN(date.getTime())) return "Invalid date.";

  let partyId: string | null = null;
  if (partyName) {
    const party = await prisma.party.upsert({
      where: { name: partyName },
      update: {},
      create: { name: partyName },
    });
    partyId = party.id;
  }

  await prisma.$transaction([
    prisma.processLog.create({
      data: { productId, stage: stage as LotStatus, partyId, date, notes },
    }),
    prisma.product.update({ where: { id: productId }, data: { stage: stage as LotStatus } }),
  ]);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/manufacturing");
  revalidatePath("/polish");
  revalidatePath("/parties");
}

export async function deleteProcessLog(productId: string, processLogId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await prisma.processLog.delete({ where: { id: processLogId } });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/manufacturing");
  revalidatePath("/polish");
}

// Looks up a stone by the exact SKU encoded in its barcode and opens it —
// used by the Scan page.
export async function lookupBySku(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sku = String(formData.get("sku") ?? "").trim();
  if (!sku) return undefined;

  const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
  if (!product) return `No SKU matching "${sku}" found.`;

  redirect(`/products/${product.id}`);
}
