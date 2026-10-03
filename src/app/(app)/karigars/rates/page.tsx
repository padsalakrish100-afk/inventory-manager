import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { getStages } from "@/lib/process-stages";
import { RateCardForm } from "../rate-card-form";
import { RatesTable } from "../rates-table";

// Stage default rates — used for any karigar without their own rate for
// that stage.
export default async function DefaultRatesPage() {
  const viewer = await requirePagePermission("karigars.manage");
  if (!can(viewer, "costs.view")) redirect("/karigars");

  const [stages, rates] = await Promise.all([
    getStages(),
    prisma.processRate.findMany({
      where: { partyId: null, rate: { not: null } },
      include: { processStage: { select: { name: true, sortOrder: true } } },
      orderBy: [{ processStage: { sortOrder: "asc" } }, { effectiveFrom: "desc" }],
    }),
  ]);

  const now = new Date();
  const current = new Set<string>();
  const seen = new Set<string>();
  for (const r of rates) {
    if (r.effectiveFrom <= now && r.processStageId && !seen.has(r.processStageId)) {
      current.add(r.id);
      seen.add(r.processStageId);
    }
  }
  const billable = stages.filter((s) => s.active && s.isLabourBillable);
  const missing = billable.filter((s) => !seen.has(s.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Default rates</h1>
        <p className="mt-1 text-sm text-zinc-500">
          What a stage pays when a karigar has no rate of their own for it. Per carat is charged on the weight
          issued; per piece on pieces returned.
        </p>
        <Link href="/karigars" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Karigars
        </Link>
      </div>

      {missing.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No default rate yet for: {missing.map((s) => s.name).join(", ")}. Returns at those stages create no labour
          unless the karigar has their own rate.
        </p>
      )}

      <RateCardForm stages={billable.map((s) => ({ id: s.id, name: s.name }))} />
      <RatesTable rates={rates} currentRateIds={current} />
    </div>
  );
}
