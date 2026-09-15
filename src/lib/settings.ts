import { prisma } from "@/lib/prisma";

export type AppSettings = {
  appName: string;
  locations: string[];
  accentColor: string;
  updatedAtIso: string;
};

export async function getSettings(): Promise<AppSettings> {
  const row =
    (await prisma.setting.findUnique({ where: { id: "singleton" } })) ??
    (await prisma.setting.create({ data: {} }));

  return {
    appName: row.appName,
    locations: row.locations
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean),
    accentColor: row.accentColor,
    updatedAtIso: row.updatedAt.toISOString(),
  };
}
