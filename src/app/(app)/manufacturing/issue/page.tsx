import { prisma } from "@/lib/prisma";
import { IssueForm } from "./issue-form";

export default async function IssuePage() {
  const [parties, rates] = await Promise.all([
    prisma.party.findMany({
      where: { category: "KARIGAR", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.processRate.findMany({
      where: { process: { not: null }, party: { category: "KARIGAR" } },
      include: { party: true },
      orderBy: { effectiveFrom: "desc" },
    }),
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
      <IssueForm
        partyNames={parties.map((p) => p.name)}
        rates={[...currentRates.entries()].map(([key, ratePerCarat]) => {
          const [partyName, process] = key.split("::");
          return { partyName, process, ratePerCarat };
        })}
      />
    </div>
  );
}
