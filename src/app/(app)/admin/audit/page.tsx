import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDateTime } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

type Search = { entity?: string; entityId?: string; userId?: string; action?: string; from?: string; to?: string; page?: string };

function istDayStart(date: string): Date | undefined {
  const d = new Date(`${date}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const from = sp.from ? istDayStart(sp.from) : undefined;
  const toStart = sp.to ? istDayStart(sp.to) : undefined;
  const to = toStart ? new Date(toStart.getTime() + 86_400_000) : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.entityId?.trim() ? { entityId: sp.entityId.trim() } : {}),
    ...(sp.userId ? { userId: sp.userId } : {}),
    ...(sp.action ? { action: sp.action } : {}),
    ...(from || to ? { at: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };

  const [entries, total, entities, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/admin/audit?${params.toString()}`;
  }

  const selectClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Audit log</h1>
        <p className="mt-1 text-sm text-zinc-500">Every change — who made it, when (IST), and the old → new values.</p>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Record type</label>
          <select name="entity" defaultValue={sp.entity ?? ""} className={selectClass}>
            <option value="">All</option>
            {entities.map((e) => (
              <option key={e.entity} value={e.entity}>
                {e.entity}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Record ID</label>
          <input name="entityId" defaultValue={sp.entityId ?? ""} className={selectClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">User</label>
          <select name="userId" defaultValue={sp.userId ?? ""} className={selectClass}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Action</label>
          <select name="action" defaultValue={sp.action ?? ""} className={selectClass}>
            <option value="">All</option>
            {["CREATE", "UPDATE", "DELETE", "VOID", "BULK_CREATE", "EXPORT", "UNLOCK"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">From</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={selectClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">To</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={selectClass} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="min-h-10 flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Search
          </button>
          <Link href="/admin/audit" className="flex min-h-10 items-center px-2 text-sm text-zinc-500 hover:underline">
            Clear
          </Link>
        </div>
      </form>

      <p className="text-sm text-zinc-500">
        {total.toLocaleString("en-IN")} entr{total === 1 ? "y" : "ies"} · page {page} of {pages}
      </p>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">No entries.</p>}
        {entries.map((e) => {
          const before = (e.before ?? {}) as Record<string, unknown>;
          const after = (e.after ?? {}) as Record<string, unknown>;
          const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
          return (
            <div key={e.id} className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.action === "DELETE" ? "bg-red-50 text-red-700" : e.action === "CREATE" || e.action === "BULK_CREATE" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                  }`}
                >
                  {e.action}
                </span>
                <span className="font-medium text-zinc-900">{e.entity}</span>
                {e.entityId && (
                  <Link href={`/admin/audit?entity=${e.entity}&entityId=${e.entityId}`} className="font-mono text-xs text-zinc-500 hover:underline">
                    {e.entityId}
                  </Link>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  {formatDateTime(e.at)} · {e.user?.name ?? "System"}
                </span>
              </div>
              {keys.length > 0 && (
                <details className="mt-2" open={e.action === "UPDATE" && keys.length <= 6}>
                  <summary className="cursor-pointer text-xs text-zinc-500">
                    {keys.length} field{keys.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <tbody>
                        {keys.map((k) => (
                          <tr key={k} className="border-t border-zinc-100 align-top">
                            <td className="py-1 pr-3 font-mono text-zinc-500">{k}</td>
                            {e.action === "UPDATE" ? (
                              <td className="py-1 break-all">
                                <span className="text-red-700 line-through decoration-red-300">{display(before[k])}</span>
                                <span className="px-1.5 text-zinc-400">→</span>
                                <span className="text-emerald-700">{display(after[k])}</span>
                              </td>
                            ) : (
                              <td className="py-1 break-all text-zinc-800">{display(k in after ? after[k] : before[k])}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              &larr; Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages && (
            <Link href={pageHref(page + 1)} className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              Older &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
