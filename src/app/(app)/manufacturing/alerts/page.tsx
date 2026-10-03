import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { ReviewButton } from "./review-button";

// Returns whose loss went over the allowed % for that stage/karigar. Open
// alerts stay here until a manager or admin marks them reviewed.
export default async function ExcessLossAlertsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await requirePagePermission("mfg.view");
  const { show } = await searchParams;
  const showReviewed = show === "all";
  const canReview = can(viewer, "mfg.reports");

  const alerts = await prisma.processMovement.findMany({
    where: { isExcessLoss: true, voidedAt: null, ...(showReviewed ? {} : { excessReviewedAt: null }) },
    include: {
      product: { select: { id: true, sku: true } },
      party: { select: { name: true } },
      toDepartment: { select: { name: true } },
      stage: { select: { name: true } },
      returnedBy: { select: { name: true } },
      excessReviewedBy: { select: { name: true } },
    },
    orderBy: { returnDate: "desc" },
    take: 500,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Excess loss</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Returns that lost more than the allowed % for their stage and karigar. Limits are set in Settings.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/manufacturing/alerts"
            className={`min-h-10 rounded-md border px-3 py-2 ${!showReviewed ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"}`}
          >
            Open
          </Link>
          <Link
            href="/manufacturing/alerts?show=all"
            className={`min-h-10 rounded-md border px-3 py-2 ${showReviewed ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"}`}
          >
            All
          </Link>
        </div>
      </div>

      {alerts.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          {showReviewed ? "No excess-loss returns recorded." : "No open alerts."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {alerts.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border bg-white p-4 ${m.excessReviewedAt ? "border-zinc-200" : "border-red-300"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/stones/${m.product.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:underline">
                    {m.product.sku}
                  </Link>
                  <span className="text-sm text-zinc-600">
                    {m.stage?.name ?? "—"} · {m.party?.name ?? m.toDepartment?.name ?? "—"}
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-red-700">
                    {Number(m.lossPct).toFixed(2)}% loss
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    ({m.lossWeight?.toString()} ct of {m.issueWeight} ct) · allowed {Number(m.lossLimitPct).toFixed(2)}%
                  </span>
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  <span className="text-zinc-500">Reason:</span> {m.excessReason ?? "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Returned {formatDate(m.returnDate)}
                  {m.returnedBy ? ` · by ${m.returnedBy.name}` : ""}
                </p>
                {m.excessReviewedAt && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Reviewed {formatDate(m.excessReviewedAt)}
                    {m.excessReviewedBy ? ` by ${m.excessReviewedBy.name}` : ""}
                    {m.excessReviewNote ? ` — ${m.excessReviewNote}` : ""}
                  </p>
                )}
              </div>
              {canReview && !m.excessReviewedAt && <ReviewButton movementId={m.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
