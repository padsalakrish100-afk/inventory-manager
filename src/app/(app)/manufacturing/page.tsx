import Link from "next/link";
import { requirePagePermission, can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getStages } from "@/lib/process-stages";
import { daysSince } from "@/lib/dates";
import { StoneLookupForm } from "./stone-lookup-form";

export default async function ManufacturingPage() {
  const viewer = await requirePagePermission("mfg.view");
  const [stages, outByStage, inHandCount, polishedCount, openAlerts, setting, oldest] = await Promise.all([
    getStages(),
    prisma.product.groupBy({ by: ["currentStageId"], where: { currentStageId: { not: null } }, _count: true }),
    prisma.product.count({ where: { status: "IN_PRODUCTION", currentStageId: null, currentProcess: null } }),
    prisma.product.count({ where: { polishedStone: { isNot: null } } }),
    prisma.processMovement.count({ where: { isExcessLoss: true, excessReviewedAt: null, voidedAt: null } }),
    prisma.setting.findUnique({ where: { id: "singleton" }, select: { pendingAlertDays: true } }),
    prisma.processMovement.findMany({
      where: { returnDate: null, voidedAt: null },
      select: { issueDate: true },
      orderBy: { issueDate: "asc" },
      take: 5000,
    }),
  ]);
  const alertDays = setting?.pendingAlertDays ?? 7;
  const outCount = outByStage.reduce((s, g) => s + g._count, 0);
  const overdueCount = oldest.filter((m) => daysSince(m.issueDate) > alertDays).length;
  const countFor = (stageId: string) => outByStage.find((g) => g.currentStageId === stageId)?._count ?? 0;
  const visibleStages = stages.filter((s) => s.active || countFor(s.id) > 0);

  const linkClass = "min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Manufacturing</h1>
          <p className="mt-1 text-sm text-zinc-500">Where every stone in production is right now.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {can(viewer, "mfg.issueReturn") && (
            <>
              <Link
                href="/manufacturing/issue"
                className="min-h-11 rounded-md bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white hover:brightness-110"
              >
                Issue
              </Link>
              <Link href="/manufacturing/return" className={`${linkClass} text-center`}>
                Return
              </Link>
            </>
          )}
          <Link href="/manufacturing/pending" className={`${linkClass} text-center`}>
            Pending{overdueCount > 0 && <span className="ml-1 font-semibold text-red-700">({overdueCount} overdue)</span>}
          </Link>
          <Link href="/manufacturing/alerts" className={`${linkClass} text-center`}>
            Excess loss{openAlerts > 0 && <span className="ml-1 font-semibold text-red-700">({openAlerts})</span>}
          </Link>
          <Link href="/manufacturing/breakage" className={`${linkClass} text-center`}>
            Breakage
          </Link>
          {can(viewer, "mfg.reports") && (
            <Link href="/manufacturing/reports" className={`${linkClass} text-center`}>
              Reports
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In hand" sublabel="in production, not issued" value={String(inHandCount)} />
        <StatCard label="Out for process" value={String(outCount)} href="/manufacturing/pending" />
        <StatCard
          label={`Out > ${alertDays} days`}
          value={String(overdueCount)}
          alert={overdueCount > 0}
          href="/manufacturing/pending?overdue=1"
        />
        <StatCard label="Transferred to Polish" value={String(polishedCount)} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">Look up a stone</h2>
        <p className="mt-1 text-sm text-zinc-500">Scan or type a stone number to jump straight to it.</p>
        <div className="mt-3">
          <StoneLookupForm />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleStages.map((s) => {
          const count = countFor(s.id);
          return (
            <Link
              key={s.id}
              href={`/manufacturing/pending?group=party&stage=${s.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
            >
              <p className="text-sm font-medium text-zinc-700">{s.name}</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{count}</p>
              <p className="text-xs text-zinc-500">
                out{s.departmentName ? ` · ${s.departmentName}` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  alert,
  href,
}: {
  label: string;
  sublabel?: string;
  value: string;
  alert?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${alert ? "text-red-700" : "text-zinc-900"}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-zinc-400">{sublabel}</p>}
    </>
  );
  const className = `rounded-lg border bg-white p-4 ${alert ? "border-red-200" : "border-zinc-200"}`;
  return href ? (
    <Link href={href} className={`${className} hover:bg-zinc-50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
