import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDateTime, todayIST } from "@/lib/dates";
import { LockForm, UnlockButton } from "./lock-controls";

const monthLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

export default async function PeriodLocksPage() {
  await requirePagePermission("admin");
  const locks = await prisma.periodLock.findMany({ orderBy: [{ periodStart: "desc" }] });
  const userIds = [...new Set(locks.flatMap((l) => [l.lockedById, l.unlockedById]).filter((x): x is string => Boolean(x)))];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const today = todayIST();
  const lastMonth = (() => {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const label = (l: (typeof locks)[number]) =>
    l.periodType === "MONTH" ? monthLabel.format(l.periodStart) : dayLabel.format(l.periodStart);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Period locks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Close a month (or a single day) once its books are checked. Nothing dated in a closed period can be added,
          changed or voided — issues and returns, labour and payroll, costs, rough purchases, job-work bills, memos,
          invoices and payments — until an admin unlocks it. Every lock and unlock is in the audit log.
        </p>
        <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <LockForm defaultMonth={lastMonth} defaultDay={today} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {locks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No periods closed yet.
                </td>
              </tr>
            )}
            {locks.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {label(l)} <span className="text-xs font-normal text-zinc-400">{l.periodType === "MONTH" ? "month" : "day"}</span>
                </td>
                <td className="px-4 py-3">
                  {l.unlockedAt ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Unlocked</span>
                  ) : (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">Locked</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  Locked {formatDateTime(l.lockedAt)} by {users.get(l.lockedById) ?? "—"}
                  {l.note ? ` · ${l.note}` : ""}
                  {l.unlockedAt && (
                    <span className="block text-amber-700">
                      Unlocked {formatDateTime(l.unlockedAt)} by {users.get(l.unlockedById ?? "") ?? "—"}: {l.unlockReason}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{!l.unlockedAt && <UnlockButton lockId={l.id} label={label(l)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
