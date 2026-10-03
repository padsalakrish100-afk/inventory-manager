"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, type PartyRoleType } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { categoryForRoles, PARTY_ROLE_VALUES } from "@/lib/party";
import { formToObject, parseInput, zOptionalMoney, zOptionalText, zRequiredText } from "@/lib/validation";

const partySchema = z.object({
  roles: z.array(z.enum(PARTY_ROLE_VALUES)).min(1, "Choose at least one role.").default([]),
  companyName: zOptionalText(200),
  contactPerson: zOptionalText(200),
  country: zOptionalText(100),
  phone: zOptionalText(50),
  email: z.union([z.literal("").transform(() => null), z.string().trim().email("Email is invalid.").max(200)]),
  address: zOptionalText(500),
  gstin: zOptionalText(30),
  pan: zOptionalText(30),
  taxOther: zOptionalText(100),
  creditLimit: zOptionalMoney("Credit limit"),
  creditCurrency: z.enum(["USD", "INR"]).default("USD"),
  notes: zOptionalText(2000),
});

type PartyInput = z.output<typeof partySchema>;

function readParty(formData: FormData) {
  const raw = formToObject(formData);
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return parseInput(partySchema, {
    roles: Array.isArray(raw["roles[]"]) ? raw["roles[]"] : [],
    companyName: str("companyName"),
    contactPerson: str("contactPerson"),
    country: str("country"),
    phone: str("phone"),
    email: str("email"),
    address: str("address"),
    gstin: str("gstin"),
    pan: str("pan"),
    taxOther: str("taxOther"),
    creditLimit: str("creditLimit"),
    creditCurrency: str("creditCurrency") || "USD",
    notes: str("notes"),
  });
}

function partyData(d: PartyInput) {
  const taxIds = Object.fromEntries(
    Object.entries({ gstin: d.gstin, pan: d.pan, other: d.taxOther }).filter(([, v]) => v),
  );
  return {
    roles: d.roles as PartyRoleType[],
    companyName: d.companyName,
    contactPerson: d.contactPerson,
    country: d.country,
    phone: d.phone,
    email: d.email,
    address: d.address,
    taxIds: Object.keys(taxIds).length > 0 ? taxIds : undefined,
    creditLimit: d.creditLimit,
    creditCurrency: d.creditLimit !== null ? d.creditCurrency : null,
    notes: d.notes,
  };
}

export async function createParty(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");

  const nameParsed = parseInput(zRequiredText("Name"), String(formData.get("name") ?? ""));
  if (!nameParsed.ok) return nameParsed.error;
  const name = nameParsed.data;
  const parsed = readParty(formData);
  if (!parsed.ok) return parsed.error;

  const existing = await prisma.party.findUnique({ where: { name } });
  if (existing) return "A party with that name already exists.";

  await prisma.$transaction(async (tx) => {
    const data = partyData(parsed.data);
    const party = await tx.party.create({
      data: { name, ...data, category: categoryForRoles(data.roles, null) },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Party", entityId: party.id, after: party });
  });

  revalidatePath("/settings/parties");
}

export async function updateParty(
  partyId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");

  const parsed = readParty(formData);
  if (!parsed.ok) return parsed.error;

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.party.findUnique({ where: { id: partyId } });
    if (!before) return false;
    const data = partyData(parsed.data);
    const after = await tx.party.update({
      where: { id: partyId },
      data: { ...data, taxIds: data.taxIds ?? Prisma.DbNull, category: categoryForRoles(data.roles, before.category) },
    });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Party", entityId: partyId, before, after });
    return true;
  });
  if (!found) return "Party not found.";

  revalidatePath("/settings/parties");
  revalidatePath(`/settings/parties/${partyId}`);
}

export async function setPartyActive(partyId: string, active: boolean) {
  const viewer = await requirePermission("admin");
  const parsed = parseInput(z.object({ partyId: z.string().min(1), active: z.boolean() }), { partyId, active });
  if (!parsed.ok) throw new Error(parsed.error);

  await prisma.$transaction(async (tx) => {
    const before = await tx.party.findUniqueOrThrow({ where: { id: partyId } });
    const after = await tx.party.update({ where: { id: partyId }, data: { active } });
    await writeAudit(tx, viewer.id, { action: "UPDATE", entity: "Party", entityId: partyId, before, after });
  });

  revalidatePath("/settings/parties");
  revalidatePath(`/settings/parties/${partyId}`);
}
