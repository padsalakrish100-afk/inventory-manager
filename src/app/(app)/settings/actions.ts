"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
