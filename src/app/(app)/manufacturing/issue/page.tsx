import { prisma } from "@/lib/prisma";
import { IssueForm } from "./issue-form";

export default async function IssuePage() {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Issue to process</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Send stones out to a karigar or vendor for a process. Scanning each one builds the list below.
        </p>
      </div>
      <IssueForm partyNames={parties.map((p) => p.name)} />
    </div>
  );
}
