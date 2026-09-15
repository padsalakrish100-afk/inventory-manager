"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function createParty(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "BOTH");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return "Name is required.";
  if (type !== "SUPPLIER" && type !== "CUSTOMER" && type !== "BOTH") return "Invalid type.";

  const existing = await prisma.party.findUnique({ where: { name } });
  if (existing) return "A contact with that name already exists.";

  try {
    await prisma.party.create({ data: { name, type, phone, email, address, notes } });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/parties");
  revalidatePath("/transactions/new");
}

export async function deleteParty(partyId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const transactionCount = await prisma.transaction.count({ where: { partyId } });
  if (transactionCount > 0) {
    throw new Error("This contact has transaction history and cannot be deleted.");
  }

  await prisma.party.delete({ where: { id: partyId } });
  revalidatePath("/parties");
  revalidatePath("/transactions/new");
}
