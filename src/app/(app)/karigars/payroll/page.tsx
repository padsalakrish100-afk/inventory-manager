import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate, todayIST } from "@/lib/dates";
import { formatInrCents, periodBounds, rupees, unpaidPayroll } from "@/lib/karigar/payroll";
import { ExportButtons } from "@/components/export-buttons";
import { AdjustmentForm, PayButton, ReverseButton, VoidAdjustmentButton } from "./payroll-controls";

const ADJUSTMENT_LABELS = { ADVANCE: "Advance", DEDUCTION: "Deduction", BONUS: "Bonus" } as const;

function isDate(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

// Karigar-wise unpaid labour for a period, minus advances and deductions,
// plus bonuses — and paying it.
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const viewer = await requirePagePermission("karigars.manage");
  if (!can(viewer, "costs.view")) redirect("/karigars");
  const sp = await searchParams;
  const today = todayIST();
  const from = isDate(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = isDate(sp.to) ? sp.to : today;
  const { start, end } = periodBounds(from, to);

  const [lines, runs, adjustments, karigars] = await Promise.all([
    unpaidPayroll(prisma, start, end),
    prisma.payrollRun.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: { party: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.karigarAdjustment.findMany({
      where: { voidedAt: null, payrollRunId: null, date: { gte: start, lt: end } },
      include: { party: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.party.findMany({ where: { roles: { has: "KARIGAR" }, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const totals = lines.reduce(
    (t, l) => ({ labour: t.labour + l.labour, net: t.net + l.net, missingFx: t.missingFx + l.missingFx }),
    { labour: 0, net: 0, missingFx: 0 },
  );
  const isAdmin = can(viewer, "admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Payroll</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Unpaid labour per karigar for the period, less advances and deductions, plus bonuses (INR).
          </p>
          <Link href="/karigars" className="text-sm text-zinc-500 hover:underline">
            &larr; Karigars
          </Link>
        </div>
        <ExportButtons report="payroll" params={new URLSearchParams({ from, to })} />
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs font-medium text-zinc-500">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          To
          <input type="date" name="to" defaultValue={to} className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
          Show
        </button>
      </form>

      {totals.missingFx > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {totals.missingFx} labour entr{totals.missingFx === 1 ? "y has" : "ies have"} no USD/INR rate recorded (from before
          rates were entered). INR amounts are exact; add rates under{" "}
          <Link href="/settings/fx" className="underline">
            Settings → Exchange rates
          </Link>{" "}
          for USD reporting.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Karigar</th>
              <th className="px-4 py-2 font-medium text-right">Jobs</th>
              <th className="px-4 py-2 font-medium text-right">Carats</th>
              <th className="px-4 py-2 font-medium text-right">Labour</th>
              <th className="px-4 py-2 font-medium text-right">Bonus</th>
              <th className="px-4 py-2 font-medium text-right">Deduction</th>
              <th className="px-4 py-2 font-medium text-right">Advance</th>
              <th className="px-4 py-2 font-medium text-right">Net payable</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  Nothing unpaid in this period.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.partyId} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/karigars/${l.partyId}`} className="font-medium text-zinc-900 hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-zinc-600">{l.entries}</td>
                <td className="px-4 py-2 text-right text-zinc-600">{l.carats.toFixed(3)}</td>
                <td className="px-4 py-2 text-right">{formatInrCents(l.labour)}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{l.bonus ? formatInrCents(l.bonus) : "—"}</td>
                <td className="px-4 py-2 text-right text-red-700">{l.deduction ? formatInrCents(l.deduction) : "—"}</td>
                <td className="px-4 py-2 text-right text-red-700">{l.advance ? formatInrCents(l.advance) : "—"}</td>
                <td className={`px-4 py-2 text-right font-semibold ${l.net < 0 ? "text-red-700" : "text-zinc-900"}`}>
                  {formatInrCents(l.net)}
                </td>
                <td className="px-4 py-2 text-right">
                  <PayButton partyId={l.partyId} name={l.name} from={from} to={to} net={rupees(l.net)} netLabel={formatInrCents(l.net)} />
                </td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50 font-medium">
                <td className="px-4 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{formatInrCents(totals.labour)}</td>
                <td colSpan={3}></td>
                <td className="px-4 py-2 text-right">{formatInrCents(totals.net)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Advances, deductions &amp; bonuses</h2>
        <AdjustmentForm karigarNames={karigars.map((k) => k.name)} />
        {adjustments.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1">
                <span>
                  {formatDate(a.date)} · {a.party.name} · {ADJUSTMENT_LABELS[a.type]}
                  {a.note ? ` — ${a.note}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className={a.type === "BONUS" ? "text-emerald-700" : "text-red-700"}>
                    {formatInrCents(Math.round(Number(a.amount) * 100))}
                  </span>
                  <VoidAdjustmentButton adjustmentId={a.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Paid in this period</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500">No payments yet.</td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className={`border-b border-zinc-100 last:border-0 ${r.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                  <td className="px-4 py-2">{r.party.name}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {formatDate(r.periodFrom)} – {formatDate(r.periodTo)}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    paid {formatDate(r.paidAt)}
                    {r.paymentMode ? ` · ${r.paymentMode}` : ""}
                    {r.paymentRef ? ` · ${r.paymentRef}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatInrCents(Math.round(Number(r.net) * 100))}</td>
                  <td className="px-4 py-2 text-right">{isAdmin && !r.voidedAt && <ReverseButton runId={r.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
