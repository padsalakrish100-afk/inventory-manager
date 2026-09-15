"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LotStatus } from "@/generated/prisma/client";
import { STAGE_VALUES } from "@/lib/stages";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateSettings(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") return "Only admins can change settings.";

  const appName = String(formData.get("appName") ?? "").trim();
  const locationsRaw = String(formData.get("locations") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "").trim();

  if (!appName) return "App name is required.";
  if (!HEX_COLOR.test(accentColor)) return "Accent color must be a hex value like #18181b.";

  const locations = locationsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(",");

  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { appName, locations, accentColor },
    create: { id: "singleton", appName, locations, accentColor },
  });

  revalidatePath("/", "layout");
}

// Saved price list: what a given party charges per carat for a given
// process, so lot expenses don't mean retyping the same rate every time.
export async function addProcessRate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") return "Only admins can change settings.";

  const stage = String(formData.get("stage") ?? "");
  const partyName = String(formData.get("party") ?? "").trim();
  const ratePerCarat = Number(formData.get("ratePerCarat") ?? 0);
  const caratMinRaw = String(formData.get("caratMin") ?? "").trim();
  const caratMaxRaw = String(formData.get("caratMax") ?? "").trim();
  const caratMin = caratMinRaw ? Number(caratMinRaw) : null;
  const caratMax = caratMaxRaw ? Number(caratMaxRaw) : null;

  if (!(STAGE_VALUES as readonly string[]).includes(stage)) return "Invalid process.";
  if (!partyName) return "Party is required.";
  if (!Number.isFinite(ratePerCarat) || ratePerCarat <= 0) {
    return "Rate per carat must be a positive number.";
  }
  if (caratMin !== null && !Number.isFinite(caratMin)) return "Invalid carat minimum.";
  if (caratMax !== null && !Number.isFinite(caratMax)) return "Invalid carat maximum.";
  if (caratMin !== null && caratMax !== null && caratMin > caratMax) {
    return "Carat minimum can't be greater than the maximum.";
  }

  const party = await prisma.party.upsert({
    where: { name: partyName },
    update: {},
    create: { name: partyName },
  });

  await prisma.processRate.create({
    data: { stage: stage as LotStatus, partyId: party.id, ratePerCarat, caratMin, caratMax },
  });

  revalidatePath("/settings");
  revalidatePath("/lots", "layout");
}

export async function deleteProcessRate(rateId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") throw new Error("Only admins can change settings.");

  await prisma.processRate.delete({ where: { id: rateId } });
  revalidatePath("/settings");
  revalidatePath("/lots", "layout");
}
