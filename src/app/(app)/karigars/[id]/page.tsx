import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { getDepartments, getStages } from "@/lib/process-stages";
import { daysAgo, daysSince, formatDate, todayIST } from "@/lib/dates";
import { RATE_BASIS_LABELS } from "@/lib/manufacturing/labour-labels";
import { karigarPerformance } from "@/lib/karigar/performance";
import { formatInrCents } from "@/lib/karigar/payroll";
import { EditKarigarForm } from "./edit-karigar-form";
import { AdjustLabourButton, RateCardForm } from "../rate-card-form";
import { RatesTable } from "../rates-table";

const ADJUSTMENT_LABELS = { ADVANCE: "Advance", DEDUCTION: "Deduction", BONUS: "Bonus" } as const;

function inr(value: { toString(): string } | number): string {
  return formatInrCents(Math.round(Number(value) * 100));
}

export default async function KarigarPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("karigars.manage");
  const showCosts = can(viewer, "costs.view");
  const { id } = await params;

  const party = await prisma.party.findUnique({
    where: { id },
    include: { karigarProfile: true, karigarDepartments: true },
  });
  if (!party || !party.roles.includes("KARIGAR")) notFound();

  const monthStart = new Date(`${todayIST().slice(0, 8)}01T00:00:00+05:30`);
  const [departments, stages, photo, open, [month], rates, labour, adjustments, runs] = await Promise.all([
    getDepartments(),
    getStages(),
    prisma.attachment.findFirst({ where: { entityType: "KARIGAR_PHOTO", entityId: id, deletedAt: null }, select: { id: true } }),
    prisma.processMovement.findMany({
      where: { partyId: id, returnDate: null, voidedAt: null },
      include: { product: { select: { id: true, sku: true } }, stage: { select: { name: true } } },
      orderBy: { issueDate: "asc" },
    }),
    karigarPerformance(monthStart, daysAgo(-1), id),
    showCosts
      ? prisma.processRate.findMany({
          where: { partyId: id, rate: { not: null } },
          include: { processStage: { select: { name: true } } },
          orderBy: [{ processStageId: "asc" }, { effectiveFrom: "desc" }],
        })
      : Promise.resolve([]),
    showCosts
      ? prisma.labourEntry.findMany({
          where: { partyId: id, voidedAt: null },
          include: { movement: { select: { product: { select: { id: true, sku: true } } } }, stage: { select: { name: true } } },
          orderBy: { workDate: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    showCosts
      ? prisma.karigarAdjustment.findMany({ where: { partyId: id, voidedAt: null }, orderBy: { date: "desc" }, take: 20 })
      : Promise.resolve([]),
    showCosts
      ? prisma.payrollRun.findMany({ where: { partyId: id }, orderBy: { paidAt: "desc" }, take: 12 })
      : Promise.resolve([]),
  ]);

  // Rate in force per stage today = newest already-effective row.
  const now = new Date();
  const currentRateIds = new Set<string>();
  const seenStages = new Set<string>();
  for (const r of rates) {
    if (r.effectiveFrom <= now && r.processStageId && !seenStages.has(r.processStageId)) {
      currentRateIds.add(r.id);
      seenStages.add(r.processStageId);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated attachment route
          <img src={`/api/attachments/${photo.id}?thumb=1`} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-2xl font-medium text-zinc-500">
            {party.name.slice(0, 1)}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{party.name}</h1>
          <p className="text-sm text-zinc-500">
            {party.active ? "Active" : "Inactive"}
            {party.phone ? ` · ${party.phone}` : ""}
            {party.karigarProfile?.joiningDate ? ` · joined ${formatDate(party.karigarProfile.joiningDate)}` : ""}
          </p>
          <Link href="/karigars" className="text-sm text-zinc-500 hover:underline">
            &larr; All karigars
          </Link>
        </div>
      </div>

      {month && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">This month</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Returns" value={String(month.returns)} />
            <Stat label="Pieces" value={String(month.pieces)} />
            <Stat label="Carats worked" value={month.caratsIssued.toFixed(3)} />
            <Stat label="Avg loss" value={month.avgLossPct !== null ? `${month.avgLossPct.toFixed(2)}%` : "—"} />
            <Stat label="Excess loss" value={String(month.excessCount)} alert={month.excessCount > 0} />
            <Stat label="Breakage" value={String(month.breakageCount)} alert={month.breakageCount > 0} />
          </div>
          {showCosts && <p className="text-sm text-zinc-600">Labour earned this month: {inr(month.labourInr)}</p>}
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <EditKarigarForm
              partyId={party.id}
              active={party.active}
              departments={departments}
              defaults={{
                phone: party.phone ?? "",
                employeeCode: party.karigarProfile?.employeeCode ?? "",
                joiningDate: party.karigarProfile?.joiningDate
                  ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(party.karigarProfile.joiningDate)
                  : "",
                notes: party.karigarProfile?.notes ?? "",
                departmentIds: party.karigarDepartments.map((d) => d.departmentId),
              }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">In hand now ({open.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody>
                {open.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-zinc-500">Nothing issued to this karigar right now.</td>
                  </tr>
                )}
                {open.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/stones/${m.product.id}`} className="font-mono text-xs font-medium hover:underline">
                        {m.product.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{m.stage?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-600">{m.issueWeight ?? "—"} ct</td>
                    <td className="px-4 py-2 text-right text-zinc-600">{daysSince(m.issueDate)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showCosts && (
        <>
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Rate card</h2>
              <p className="text-sm text-zinc-500">
                This karigar&apos;s own rates. Stages without one use the{" "}
                <Link href="/karigars/rates" className="underline">
                  default rate
                </Link>
                . A new rate applies from its date; labour already worked out never changes.
              </p>
            </div>
            <RateCardForm partyId={party.id} stages={stages.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))} />
            <RatesTable rates={rates} currentRateIds={currentRateIds} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Recent labour</h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Stone</th>
                    <th className="px-4 py-2 font-medium">Stage</th>
                    <th className="px-4 py-2 font-medium">Rate × qty</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {labour.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                        No labour yet — it&apos;s created automatically when stones come back.
                      </td>
                    </tr>
                  )}
                  {labour.map((l) => (
                    <tr key={l.id} className="border-b border-zinc-100 align-top last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap text-zinc-600">{formatDate(l.workDate)}</td>
                      <td className="px-4 py-2">
                        <Link href={`/stones/${l.movement.product.id}`} className="font-mono text-xs hover:underline">
                          {l.movement.product.sku}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{l.stage?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600">
                        ₹{l.rate.toString()} {RATE_BASIS_LABELS[l.basis]} × {Number(l.quantity)}
                        {l.source !== "RATE_CARD" && (
                          <span className="block text-xs text-zinc-400">
                            {l.source === "ADJUSTED" ? `Adjusted: ${l.note ?? ""}` : l.source === "LEGACY" ? "From before rate cards" : "Priced at issue"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-900">{inr(l.amount)}</td>
                      <td className="px-4 py-2 text-right">
                        {l.payrollRunId ? (
                          <span className="text-xs text-emerald-700">Paid</span>
                        ) : (
                          <AdjustLabourButton entryId={l.id} amount={l.amount.toString()} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">Advances &amp; deductions</h2>
              <p className="text-sm text-zinc-500">
                Add them on the{" "}
                <Link href="/karigars/payroll" className="underline">
                  Payroll
                </Link>{" "}
                page.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {adjustments.length === 0 && <li className="text-zinc-500">None.</li>}
                {adjustments.map((a) => (
                  <li key={a.id} className="flex justify-between rounded-md border border-zinc-200 bg-white px-3 py-2">
                    <span>
                      {formatDate(a.date)} · {ADJUSTMENT_LABELS[a.type]}
                      {a.note ? ` — ${a.note}` : ""}
                      {a.payrollRunId && <span className="ml-2 text-xs text-emerald-700">settled</span>}
                    </span>
                    <span className={a.type === "BONUS" ? "text-emerald-700" : "text-red-700"}>
                      {a.type === "BONUS" ? "+" : "−"}
                      {inr(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">Payroll history</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {runs.length === 0 && <li className="text-zinc-500">Never paid through payroll yet.</li>}
                {runs.map((r) => (
                  <li key={r.id} className={`flex justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 ${r.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                    <span>
                      {formatDate(r.periodFrom)} – {formatDate(r.periodTo)} · paid {formatDate(r.paidAt)}
                      {r.paymentMode ? ` (${r.paymentMode})` : ""}
                    </span>
                    <span className="font-medium">{inr(r.net)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-3 ${alert ? "border-red-200" : "border-zinc-200"}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${alert ? "text-red-700" : "text-zinc-900"}`}>{value}</p>
    </div>
  );
}
