import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type StageInfo = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  departmentId: string | null;
  departmentName: string | null;
  legacyProcess: string | null;
  defaultLossLimitPct: string | null;
  isLabourBillable: boolean;
  active: boolean;
};

export const getStages = cache(async (): Promise<StageInfo[]> => {
  const stages = await prisma.processStage.findMany({
    include: { department: { select: { name: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return stages.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    sortOrder: s.sortOrder,
    departmentId: s.departmentId,
    departmentName: s.department?.name ?? null,
    legacyProcess: s.legacyProcess,
    defaultLossLimitPct: s.defaultLossLimitPct?.toString() ?? null,
    isLabourBillable: s.isLabourBillable,
    active: s.active,
  }));
});

// The stage that corresponds to an old ProcessName value, if any.
export async function stageForProcess(process: string): Promise<StageInfo | null> {
  const stages = await getStages();
  return stages.find((s) => s.legacyProcess === process) ?? null;
}

// Sawing stages record "tops" (cut-off pieces) on return.
export function isSawingStage(stage: { code: string } | null | undefined): boolean {
  return Boolean(stage && stage.code.includes("SAWING"));
}

export const getDepartments = cache(async () =>
  prisma.department.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  }),
);
