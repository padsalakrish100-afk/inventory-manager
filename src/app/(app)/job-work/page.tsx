import { num } from "@/lib/decimal";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { daysSince, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { VoidBillButton } from "./void-bill-button";

// Outside factories (parties with the Job-worker role): what's out with
// them, returns not yet billed, and their bills.
export default async function JobWorkPage() {
  const viewer = await requirePagePermission("karigars.manage");
  const showCosts = can(viewer, "costs.view");

  const workers = await prisma.party.findMany({
    where: { roles: { has: "JOB_WORKER" } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, phone: true },
  });
  const ids = workers.map((w) => w.id);
  const [open, unbilled, bills] = await Promise.all([
    prisma.processMovement.findMany({
      where: { partyId: { in: ids }, returnDate: null, voidedAt: null },
      include: { product: { select: { id: true, sku: true } }, stage: { select: { name: true } } },
      orderBy: { issueDate: "asc" },
    }),
    prisma.processMovement.groupBy({
      by: ["partyId"],
      where: { partyId: { in: ids }, returnDate: { not: null }, voidedAt: null, jobWorkBillId: null },
      _count: true,
    }),
    showCosts
      ? prisma.jobWorkBill.findMany({
          where: { partyId: { in: ids } },
          include: { party: { select: { name: true } }, _count: { select: { movements: true } } },
          orderBy: { date: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Outside job-work</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Issue to an outside factory like any karigar (Issue → Karigar → their name). Loss is tracked the same way;
          their cost comes from their bill. Add job-workers under Settings → Parties with the Job-worker role.
        </p>
      </div>

      {workers.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No job-workers yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {workers.map((w) => {
          const out = open.filter((m) => m.partyId === w.id);
          const toBill = unbilled.find((u) => u.partyId === w.id)?._count ?? 0;
          return (
            <div key={w.id} className={`rounded-lg border border-zinc-200 bg-white p-4 ${w.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{w.name}</p>
                  <p className="text-xs text-zinc-500">
                    {out.length} out · {toBill} returned, not billed{w.phone ? ` · ${w.phone}` : ""}
                  </p>
                </div>
                {showCosts && toBill > 0 && (
                  <Link
                    href={`/job-work/bills/new?party=${w.id}`}
                    className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Enter bill
                  </Link>
                )}
              </div>
              {out.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {out.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <Link href={`/stones/${m.product.id}`} className="font-mono text-xs hover:underline">
                        {m.product.sku}
                      </Link>
                      <span className="text-zinc-500">
                        {m.stage?.name} · {num(m.issueWeight)} ct · {daysSince(m.issueDate)}d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {showCosts && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Bills</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Job-worker</th>
                  <th className="px-4 py-2 font-medium">Bill no.</th>
                  <th className="px-4 py-2 font-medium text-right">Jobs</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                      No bills yet.
                    </td>
                  </tr>
                )}
                {bills.map((b) => (
                  <tr key={b.id} className={`border-b border-zinc-100 last:border-0 ${b.voidedAt ? "text-zinc-400 line-through" : ""}`}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(b.date)}</td>
                    <td className="px-4 py-2">{b.party.name}</td>
                    <td className="px-4 py-2">{b.billNo}</td>
                    <td className="px-4 py-2 text-right">{b._count.movements}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMoney(Number(b.amount), b.currency)}</td>
                    <td className="px-4 py-2 text-right">{can(viewer, "admin") && !b.voidedAt && <VoidBillButton billId={b.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
