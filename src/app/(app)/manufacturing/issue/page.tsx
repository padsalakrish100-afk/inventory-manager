import { prisma } from "@/lib/prisma";
import { can, canWorkInDepartment, requirePagePermission } from "@/lib/authz";
import { getStages } from "@/lib/process-stages";
import { PROCESS_OPTIONS } from "@/lib/process";
import { IssueForm } from "./issue-form";

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const viewer = await requirePagePermission("mfg.issueReturn");
  const { sku } = await searchParams;
  const showLabour = can(viewer, "costs.view");

  // A process can be issued to if its stage is active and (for operators)
  // in one of their departments. Processes without a stage row stay open.
  const stages = await getStages();
  const processOptions = PROCESS_OPTIONS.filter((p) => {
    const stage = stages.find((s) => s.legacyProcess === p.value);
    if (stage && !stage.active) return false;
    return canWorkInDepartment(viewer, stage?.departmentId);
  }).map((p) => ({ value: p.value, label: stages.find((s) => s.legacyProcess === p.value)?.name ?? p.label }));

  const [parties, rates] = await Promise.all([
    prisma.party.findMany({
      where: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] }, active: true },
      orderBy: { name: "asc" },
    }),
    showLabour
      ? prisma.processRate.findMany({
          where: { process: { not: null }, party: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] } } },
          include: { party: true },
          orderBy: { effectiveFrom: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Only the current rate per (party, process) — the most recent
  // effectiveFrom that isn't in the future.
  const now = new Date();
  const currentRates = new Map<string, number>();
  for (const rate of rates) {
    if (!rate.process || rate.effectiveFrom > now) continue;
    const key = `${rate.party.name}::${rate.process}`;
    if (!currentRates.has(key)) currentRates.set(key, rate.ratePerCarat);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Issue to process</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Send stones out to a karigar for a process. Scanning each one builds the list below.
        </p>
      </div>
      {processOptions.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You aren&apos;t assigned to any department with an active process. Ask an admin to assign you on the Users page.
        </p>
      ) : (
        <IssueForm
          partyNames={parties.map((p) => p.name)}
          processOptions={processOptions}
          showLabour={showLabour}
          initialSku={sku}
          rates={[...currentRates.entries()].map(([key, ratePerCarat]) => {
            const [partyName, process] = key.split("::");
            return { partyName, process, ratePerCarat };
          })}
        />
      )}
    </div>
  );
}
