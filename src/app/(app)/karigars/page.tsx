import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { getDepartments } from "@/lib/process-stages";
import { formatDate } from "@/lib/dates";
import { NewKarigarForm } from "./new-karigar-form";

type Search = { q?: string; department?: string; inactive?: string };

export default async function KarigarsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requirePagePermission("karigars.manage");
  const sp = await searchParams;
  const showCosts = can(viewer, "costs.view");
  const departments = await getDepartments();

  const karigars = await prisma.party.findMany({
    where: {
      roles: { has: "KARIGAR" },
      ...(sp.inactive === "1" ? {} : { active: true }),
      ...(sp.q?.trim()
        ? {
            OR: [
              { name: { contains: sp.q.trim(), mode: "insensitive" as const } },
              { phone: { contains: sp.q.trim() } },
              { karigarProfile: { employeeCode: { contains: sp.q.trim(), mode: "insensitive" as const } } },
            ],
          }
        : {}),
      ...(sp.department ? { karigarDepartments: { some: { departmentId: sp.department } } } : {}),
    },
    include: {
      karigarProfile: true,
      karigarDepartments: { include: { department: { select: { name: true } } } },
      _count: { select: { stonesCurrentlyAt: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 500,
  });
  const photos = await prisma.attachment.findMany({
    where: { entityType: "KARIGAR_PHOTO", entityId: { in: karigars.map((k) => k.id) }, deletedAt: null },
    select: { id: true, entityId: true },
  });
  const photoBy = new Map(photos.map((p) => [p.entityId, p.id]));

  const linkClass = "min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50";
  const selectClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:py-2 sm:text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Karigars</h1>
          <p className="mt-1 text-sm text-zinc-500">The people who work the stones, their rates, labour, and pay.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showCosts && (
            <>
              <Link href="/karigars/payroll" className={linkClass}>
                Payroll
              </Link>
              <Link href="/karigars/rates" className={linkClass}>
                Default rates
              </Link>
            </>
          )}
          <Link href="/karigars/performance" className={linkClass}>
            Performance
          </Link>
          <Link href="/job-work" className={linkClass}>
            Outside job-work
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-3">
          <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-4 sm:items-end">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-500">Search</label>
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, phone, code" className={selectClass} />
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
              <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} className="h-4 w-4" />
              Include inactive
            </label>
            <button type="submit" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              Filter
            </button>
          </form>

          {karigars.length === 0 && (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">No karigars found.</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {karigars.map((k) => (
              <Link
                key={k.id}
                href={`/karigars/${k.id}`}
                className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:bg-zinc-50 ${k.active ? "" : "opacity-50"}`}
              >
                {photoBy.has(k.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated attachment route
                  <img src={`/api/attachments/${photoBy.get(k.id)}?thumb=1`} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium text-zinc-500">
                    {k.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{k.name}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {k.karigarDepartments.map((d) => d.department.name).join(", ") || "No department"}
                    {k.karigarProfile?.employeeCode ? ` · ${k.karigarProfile.employeeCode}` : ""}
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {k._count.stonesCurrentlyAt > 0 ? `${k._count.stonesCurrentlyAt} stones in hand` : "Nothing in hand"}
                    {k.karigarProfile?.joiningDate ? ` · since ${formatDate(k.karigarProfile.joiningDate)}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="h-fit rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add karigar</h2>
          <div className="mt-4">
            <NewKarigarForm departments={departments} />
          </div>
        </div>
      </div>
    </div>
  );
}
