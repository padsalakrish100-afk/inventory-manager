import { prisma } from "@/lib/prisma";
import { canWorkInDepartment, requirePagePermission } from "@/lib/authz";
import { getDepartments, getStages } from "@/lib/process-stages";
import { IssueForm } from "./issue-form";

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const viewer = await requirePagePermission("mfg.issueReturn");
  const { sku } = await searchParams;

  // Active stages this user may issue to (operators: their departments).
  const stages = (await getStages())
    .filter((s) => s.active && canWorkInDepartment(viewer, s.departmentId))
    .map((s) => ({ id: s.id, name: s.name, legacyProcess: s.legacyProcess, departmentId: s.departmentId }));

  const [parties, departments] = await Promise.all([
    prisma.party.findMany({
      where: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] }, active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getDepartments(),
  ]);


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Issue to process</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Send stones to a karigar or department for a stage. Scanning each one builds the list below.
        </p>
      </div>
      {stages.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You aren&apos;t assigned to any department with an active stage. Ask an admin to assign you on the Users page.
        </p>
      ) : (
        <IssueForm
          partyNames={parties.map((p) => p.name)}
          stages={stages}
          departments={departments}
          initialSku={sku}
        />
      )}
    </div>
  );
}
