import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { StageForm } from "./stage-form";

export default async function StagesPage() {
  await requirePagePermission("admin");

  const [stages, departments] = await Promise.all([
    prisma.processStage.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const nextOrder = (stages.at(-1)?.sortOrder ?? 0) + 10;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Process stages</h1>
        <p className="mt-1 text-sm text-zinc-500">
          The manufacturing steps, in order. Stages can be renamed or deactivated but never deleted, so old records
          keep their meaning. A return losing more than the allowed % is flagged as excess loss (karigar-specific
          limits are on the Loss limits page).
        </p>
        <Link href="/settings" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {stages.map((s) => (
          <StageForm
            key={s.id}
            stageId={s.id}
            code={s.code}
            legacy={s.legacyProcess !== null}
            departments={departments}
            defaults={{
              name: s.name,
              sortOrder: s.sortOrder,
              departmentId: s.departmentId,
              defaultLossLimitPct: s.defaultLossLimitPct?.toString() ?? null,
              isLabourBillable: s.isLabourBillable,
              active: s.active,
            }}
          />
        ))}
      </div>

      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Add a stage</h2>
        <StageForm
          departments={departments}
          defaults={{
            name: "",
            sortOrder: nextOrder,
            departmentId: null,
            defaultLossLimitPct: null,
            isLabourBillable: true,
            active: true,
          }}
        />
      </section>
    </div>
  );
}
