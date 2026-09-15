import { prisma } from "@/lib/prisma";

export type AppSettings = {
  appName: string;
  locations: string[];
  accentColor: string;
  updatedAtIso: string;
};

export async function getSettings(): Promise<AppSettings> {
  let row = await prisma.setting.findUnique({ where: { id: "singleton" } });

  if (!row) {
    try {
      row = await prisma.setting.create({ data: {} });
    } catch {
      // Another concurrent request created it first — read what it wrote.
      row = await prisma.setting.findUnique({ where: { id: "singleton" } });
      if (!row) throw new Error("Failed to load or create app settings.");
    }
  }

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
