"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ImportResult = {
  error?: string;
  created?: number;
  updated?: number;
  skipped?: { row: number; reason: string }[];
  unmatchedLots?: number;
};

function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key].trim();
  }
  return "";
}

export async function importProducts(
  _prevState: ImportResult | undefined,
  formData: FormData,
): Promise<ImportResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    return { error: `Could not read the file: ${parsed.errors[0].message}` };
  }
  if (parsed.data.length === 0) {
    return { error: "The file has no data rows." };
  }

  const lots = await prisma.lot.findMany();
  const lotByNumber = new Map(lots.map((l) => [l.lotNumber, l.id]));

  let created = 0;
  let updated = 0;
  let unmatchedLots = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNumber = i + 2; // account for header row, 1-indexed

    const sku = cell(row, "SKU", "sku");
    const name = cell(row, "Name", "name");

    if (!sku || !name) {
      skipped.push({ row: rowNumber, reason: "Missing SKU or Name." });
      continue;
    }

    const location = cell(row, "Location", "location") || null;
    const certRaw = cell(row, "Certification", "certification").toLowerCase();
    const giaCertified = certRaw === "gia" || certRaw === "true" || certRaw === "yes";

    const caratRaw = cell(row, "Carat Weight", "caratWeight");
    const caratWeight = caratRaw ? Number(caratRaw) : null;
    if (caratWeight !== null && (!Number.isFinite(caratWeight) || caratWeight < 0)) {
      skipped.push({ row: rowNumber, reason: `Invalid carat weight "${caratRaw}".` });
      continue;
    }

    const color = cell(row, "Color", "color") || null;
    const clarity = cell(row, "Clarity", "clarity") || null;
    const cutGrade = cell(row, "Cut Grade", "cutGrade") || null;

    const stockRaw = cell(row, "Stock", "stock");
    const stock = stockRaw ? Number(stockRaw) : 0;
    if (!Number.isFinite(stock) || stock < 0) {
      skipped.push({ row: rowNumber, reason: `Invalid stock "${stockRaw}".` });
      continue;
    }

    const unit = cell(row, "Unit", "unit") || "pcs";

    const reorderRaw = cell(row, "Reorder Level", "reorderLevel");
    const reorderLevel = reorderRaw ? Number(reorderRaw) : 0;
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      skipped.push({ row: rowNumber, reason: `Invalid reorder level "${reorderRaw}".` });
      continue;
    }

    const costRaw = cell(row, "Cost Price", "costPrice");
    const costPrice = costRaw ? Number(costRaw) : 0;
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      skipped.push({ row: rowNumber, reason: `Invalid cost price "${costRaw}".` });
      continue;
    }

    const sellingRaw = cell(row, "Selling Price", "sellingPrice");
    const sellingPrice = sellingRaw ? Number(sellingRaw) : 0;
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      skipped.push({ row: rowNumber, reason: `Invalid selling price "${sellingRaw}".` });
      continue;
    }

    const lotNumber = cell(row, "Lot", "lot", "lotNumber");
    let lotId: string | null = null;
    if (lotNumber) {
      const match = lotByNumber.get(lotNumber);
      if (match) lotId = match;
      else unmatchedLots++;
    }

    const data = {
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
    };

    try {
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({ where: { sku }, data });
        updated++;
      } else {
        await prisma.product.create({ data: { ...data, sku } });
        created++;
      }
    } catch (error) {
      skipped.push({
        row: rowNumber,
        reason: error instanceof Error ? error.message : "Could not save this row.",
      });
    }
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { created, updated, skipped, unmatchedLots };
}
