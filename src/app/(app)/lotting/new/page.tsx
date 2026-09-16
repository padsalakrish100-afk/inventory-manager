import { prisma } from "@/lib/prisma";
import { LotForm } from "../lot-form";

export default async function NewLotPage() {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New lot</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Rough came in from a tender or a party — log it and get every stone numbered.
        </p>
      </div>
      <LotForm partyNames={parties.map((p) => p.name)} />
    </div>
  );
}
