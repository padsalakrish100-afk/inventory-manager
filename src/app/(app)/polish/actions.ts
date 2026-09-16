"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
