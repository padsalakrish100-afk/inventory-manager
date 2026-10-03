import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { DeleteLossLimitButton, LossLimitForm } from "./loss-limit-form";

export default async function LossLimitsPage() {
  await requirePagePermission("admin");

  const [stages, limits, karigars] = await Promise.all([
    prisma.processStage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.lossLimit.findMany({
      where: { partyId: { not: null } },
      include: { stage: { select: { name: true } }, party: { select: { name: true } } },
      orderBy: [{ stage: { sortOrder: "asc" } }, { effectiveFrom: "desc" }],
    }),
    prisma.party.findMany({
      where: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] }, active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  // The limit in force today per karigar+stage is the newest one already effective.
  const now = new Date();
  const inForce = new Set<string>();
  const seen = new Set<string>();
  for (const l of limits) {
    const key = `${l.stageId}:${l.partyId}`;
    if (l.effectiveFrom <= now && !seen.has(key)) {
      inForce.add(l.id);
      seen.add(key);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Loss limits</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A return that loses more than the allowed % is flagged red, needs a reason, and appears in Excess loss. A
          karigar-specific limit beats the stage default.
        </p>
        <Link href="/settings" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Stage defaults</h2>
          <Link href="/settings/stages" className="text-sm text-zinc-600 underline">
            Edit on Stages
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stages.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <p className="text-sm text-zinc-700">{s.name}</p>
              <p className={`text-lg font-semibold ${s.defaultLossLimitPct ? "text-zinc-900" : "text-zinc-300"}`}>
                {s.defaultLossLimitPct ? `${Number(s.defaultLossLimitPct)}%` : "No limit"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Karigar-specific limits</h2>
        <LossLimitForm stages={stages.map((s) => ({ id: s.id, name: s.name }))} karigarNames={karigars.map((k) => k.name)} />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Karigar</th>
                <th className="px-4 py-2 font-medium">Allowed</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {limits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    None yet — every karigar uses the stage default.
                  </td>
                </tr>
              )}
              {limits.map((l) => (
                <tr key={l.id} className={`border-b border-zinc-100 last:border-0 ${inForce.has(l.id) || l.effectiveFrom > now ? "" : "text-zinc-400"}`}>
                  <td className="px-4 py-2">{l.stage.name}</td>
                  <td className="px-4 py-2">{l.party?.name}</td>
                  <td className="px-4 py-2 font-medium">{Number(l.allowedPct)}%</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatDate(l.effectiveFrom)}
                    {inForce.has(l.id) && <span className="ml-2 text-xs text-emerald-700">in force</span>}
                    {l.effectiveFrom > now && <span className="ml-2 text-xs text-sky-700">upcoming</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeleteLossLimitButton limitId={l.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
