"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { PartyCategory, ProcessName } from "@/generated/prisma/client";
import { PARTY_CATEGORY_VALUES } from "@/lib/party-category";
import { PROCESS_VALUES } from "@/lib/process";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can manage parties.");
  }
  return session;
}

export async function createParty(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return "Name is required.";
  if (!category || !(PARTY_CATEGORY_VALUES as readonly string[]).includes(category)) {
    return "Choose a category.";
  }

  const existing = await prisma.party.findUnique({ where: { name } });
  if (existing) return "A party with that name already exists.";

  await prisma.party.create({
    data: { name, category: category as PartyCategory, phone, email, address, notes },
  });

  revalidatePath("/settings/parties");
}

export async function updateParty(
  partyId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireAdmin();

  const category = String(formData.get("category") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!category || !(PARTY_CATEGORY_VALUES as readonly string[]).includes(category)) {
    return "Choose a category.";
  }

  await prisma.party.update({
    where: { id: partyId },
    data: { category: category as PartyCategory, phone, email, address, notes },
  });

  revalidatePath("/settings/parties");
  revalidatePath(`/settings/parties/${partyId}`);
}

export async function setPartyActive(partyId: string, active: boolean) {
  await requireAdmin();

  await prisma.party.update({ where: { id: partyId }, data: { active } });

  revalidatePath("/settings/parties");
  revalidatePath(`/settings/parties/${partyId}`);
}

export async function addProcessRate(
  partyId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireAdmin();

  const process = String(formData.get("process") ?? "").trim();
  const ratePerCarat = Number(formData.get("ratePerCarat") ?? 0);
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const effectiveFrom = effectiveFromRaw ? new Date(effectiveFromRaw) : new Date();

  if (!(PROCESS_VALUES as readonly string[]).includes(process)) return "Invalid process.";
  if (!Number.isFinite(ratePerCarat) || ratePerCarat <= 0) {
    return "Rate per carat must be a positive number.";
  }
  if (Number.isNaN(effectiveFrom.getTime())) return "Invalid effective-from date.";

  await prisma.processRate.create({
    data: { partyId, process: process as ProcessName, ratePerCarat, effectiveFrom },
  });

  revalidatePath(`/settings/parties/${partyId}`);
  revalidatePath("/manufacturing/issue");
}

export async function deleteProcessRate(rateId: string, partyId: string) {
  await requireAdmin();

  await prisma.processRate.delete({ where: { id: rateId } });

  revalidatePath(`/settings/parties/${partyId}`);
  revalidatePath("/manufacturing/issue");
}
