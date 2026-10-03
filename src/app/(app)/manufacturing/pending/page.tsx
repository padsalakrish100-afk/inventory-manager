import { num, num0 } from "@/lib/decimal";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { getDepartments, getStages } from "@/lib/process-stages";
import { daysAgo, daysSince, formatDate } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

type Search = { stage?: string; party?: string; department?: string; group?: string; overdue?: string };

// Every stone currently out, grouped by who has it, with days out —
// anything past the configured number of days is highlighted.
export default async function PendingPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("mfg.view");
  const sp = await searchParams;
  const groupBy = sp.group === "department" ? "department" : sp.group === "stage" ? "stage" : "party";

  const [stages, departments, setting] = await Promise.all([
    getStages(),
    getDepartments(),
    prisma.setting.findUnique({ where: { id: "singleton" }, select: { pendingAlertDays: true } }),
  ]);
  const alertDays = setting?.pendingAlertDays ?? 7;

  const where: Prisma.ProcessMovementWhereInput = {
    returnDate: null,
    voidedAt: null,
    ...(sp.stage ? { stageId: sp.stage } : {}),
    ...(sp.party ? { partyId: sp.party } : {}),
    ...(sp.department ? { OR: [{ toDepartmentId: sp.department }, { stage: { departmentId: sp.department } }] } : {}),
    ...(sp.overdue === "1" ? { issueDate: { lt: daysAgo(alertDays) } } : {}),
  };

  const open = await prisma.processMovement.findMany({
    where,
    include: {
      product: { select: { id: true, sku: true } },
      party: { select: { id: true, name: true } },
      toDepartment: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, department: { select: { name: true } } } },
    },
    orderBy: { issueDate: "asc" },
    take: 2000,
  });

  const parties = await prisma.party.findMany({
    where: { id: { in: [...new Set(open.map((m) => m.partyId).filter((x): x is string => Boolean(x)))] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const groups = new Map<string, { label: string; rows: typeof open; weight: number; pieces: number; overdue: number }>();
  for (const m of open) {
    const label =
      groupBy === "stage"
        ? (m.stage?.name ?? "No stage")
        : groupBy === "department"
          ? (m.toDepartment?.name ?? m.stage?.department?.name ?? "No department")
          : (m.party?.name ?? (m.toDepartment ? `${m.toDepartment.name} (department)` : "Unassigned"));
    const g = groups.get(label) ?? { label, rows: [], weight: 0, pieces: 0, overdue: 0 };
    g.rows.push(m);
    g.weight += num0(m.issueWeight);
    g.pieces += m.issuePieces;
    if (daysSince(m.issueDate, now) > alertDays) g.overdue++;
    groups.set(label, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.overdue - a.overdue || b.rows.length - a.rows.length);
  const totalOverdue = sorted.reduce((s, g) => s + g.overdue, 0);

  const selectClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:py-2 sm:text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Pending</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {open.length} stone{open.length === 1 ? "" : "s"} out · {totalOverdue} out longer than {alertDays} days
          (change in Settings).
        </p>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-6 sm:items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Group by</label>
          <select name="group" defaultValue={groupBy} className={selectClass}>
            <option value="party">Karigar</option>
            <option value="department">Department</option>
            <option value="stage">Stage</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Stage</label>
          <select name="stage" defaultValue={sp.stage ?? ""} className={selectClass}>
            <option value="">All</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Karigar</label>
          <select name="party" defaultValue={sp.party ?? ""} className={selectClass}>
            <option value="">All</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Department</label>
          <select name="department" defaultValue={sp.department ?? ""} className={selectClass}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} className="h-4 w-4" />
          Overdue only
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-10 flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Show
          </button>
          <Link href="/manufacturing/pending" className="flex min-h-10 items-center px-2 text-sm text-zinc-500 hover:underline">
            Clear
          </Link>
        </div>
      </form>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">Nothing pending.</p>
      )}

      {sorted.map((g) => (
        <section key={g.label} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{g.label}</h2>
            <p className="text-sm text-zinc-500">
              {g.rows.length} stone{g.rows.length === 1 ? "" : "s"} · {g.pieces} pc · {g.weight.toFixed(3)} ct
              {g.overdue > 0 && <span className="font-medium text-red-700"> · {g.overdue} overdue</span>}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Stone</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">{groupBy === "party" ? "Department" : "With"}</th>
                  <th className="px-4 py-2 font-medium">Issued</th>
                  <th className="px-4 py-2 font-medium text-right">Weight</th>
                  <th className="px-4 py-2 font-medium text-right">Days out</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((m) => {
                  const days = daysSince(m.issueDate, now);
                  const overdue = days > alertDays;
                  return (
                    <tr key={m.id} className={`border-b border-zinc-100 last:border-0 ${overdue ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-2">
                        <Link href={`/stones/${m.product.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                          {m.product.sku}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{m.stage?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600">
                        {groupBy === "party"
                          ? (m.toDepartment?.name ?? m.stage?.department?.name ?? "—")
                          : (m.party?.name ?? m.toDepartment?.name ?? "—")}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-zinc-600">{formatDate(m.issueDate)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap text-zinc-600">
                        {num(m.issueWeight) ?? "—"} ct{m.issuePieces > 1 ? ` · ${m.issuePieces} pc` : ""}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${overdue ? "text-red-700" : "text-zinc-900"}`}>{days}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
