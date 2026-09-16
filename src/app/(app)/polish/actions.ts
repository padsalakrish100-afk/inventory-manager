"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PolishStatus, PaymentStatus } from "@/generated/prisma/client";
import { POLISH_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "@/lib/polish-status";

export async function updatePolishedStone(
  polishedStoneId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const certified = formData.get("certified") === "true";
  const certLab = String(formData.get("certLab") ?? "").trim() || null;
  const certNumber = String(formData.get("certNumber") ?? "").trim() || null;
  const shape = String(formData.get("shape") ?? "").trim() || null;
  const caratWeightRaw = String(formData.get("caratWeight") ?? "").trim();
  const caratWeight = caratWeightRaw ? Number(caratWeightRaw) : null;
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

  await prisma.polishedStone.update({
    where: { id: polishedStoneId },
    data: {
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

  revalidatePath("/polish");
  revalidatePath(`/polish/${polishedStoneId}`);
}

// Sales & cost tracking for a polished stone — status, where it's kept, its
// asking price, the buyer/sale details once sold, and the cost components
// that make up its total cost (computed in the app, never stored).
export async function updateSaleInfo(
  polishedStoneId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const status = String(formData.get("status") ?? "AVAILABLE");
  const location = String(formData.get("location") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "USD").trim() || "USD";
  const buyerName = String(formData.get("buyer") ?? "").trim();
  const paymentStatusRaw = String(formData.get("paymentStatus") ?? "").trim();

  if (!(POLISH_STATUS_VALUES as readonly string[]).includes(status)) return "Invalid status.";
  if (paymentStatusRaw && !(PAYMENT_STATUS_VALUES as readonly string[]).includes(paymentStatusRaw)) {
    return "Invalid payment status.";
  }

  function parseMoney(field: string): number | null {
    const raw = String(formData.get(field) ?? "").trim();
    return raw ? Number(raw) : null;
  }

  const askingPrice = parseMoney("askingPrice");
  const soldPrice = parseMoney("soldPrice");
  const roughCostAlloc = parseMoney("roughCostAlloc");
  const laborCost = parseMoney("laborCost");
  const certCost = parseMoney("certCost");
  const otherCost = parseMoney("otherCost");

  for (const [label, value] of [
    ["Asking price", askingPrice],
    ["Sold price", soldPrice],
    ["Rough cost", roughCostAlloc],
    ["Labor cost", laborCost],
    ["Certification cost", certCost],
    ["Other cost", otherCost],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return `${label} must be a non-negative number.`;
    }
  }

  const soldDateRaw = String(formData.get("soldDate") ?? "").trim();
  const soldDate = soldDateRaw ? new Date(soldDateRaw) : null;
  if (soldDateRaw && Number.isNaN(soldDate?.getTime())) return "Invalid sold date.";

  let buyerId: string | null = null;
  if (buyerName) {
    const buyer = await prisma.party.upsert({
      where: { name: buyerName },
      update: {},
      create: { name: buyerName },
    });
    buyerId = buyer.id;
  }

  await prisma.polishedStone.update({
    where: { id: polishedStoneId },
    data: {
      status: status as PolishStatus,
      location,
      askingPrice,
      currency,
      roughCostAlloc,
      laborCost,
      certCost,
      otherCost,
      buyerId,
      soldPrice,
      soldDate,
      paymentStatus: paymentStatusRaw ? (paymentStatusRaw as PaymentStatus) : null,
    },
  });

  revalidatePath("/polish");
  revalidatePath("/polish/summary");
  revalidatePath(`/polish/${polishedStoneId}`);
}

// Undoes a mistaken transfer — deletes the Stock ID and sends the stone
// back to Manufacturing so it can be transferred again correctly. Returns
// the source stone's id so the caller can navigate there itself.
export async function undoTransfer(polishedStoneId: string): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const polished = await prisma.polishedStone.findUnique({ where: { id: polishedStoneId } });
  if (!polished) throw new Error("Stock entry not found.");

  await prisma.polishedStone.delete({ where: { id: polishedStoneId } });

  revalidatePath("/polish");
  revalidatePath("/manufacturing");
  revalidatePath("/manufacturing/reports");
  return polished.sourceProductId;
}
