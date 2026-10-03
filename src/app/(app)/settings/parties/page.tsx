import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { PARTY_ROLE_OPTIONS, PARTY_ROLE_LABELS, PARTY_ROLE_STYLES } from "@/lib/party-category";
import { PartyForm } from "./party-form";
import { ActiveToggleButton } from "./active-toggle-button";
import type { PartyRoleType } from "@/generated/prisma/client";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  await requirePagePermission("admin");

  const { role, q } = await searchParams;
  const validRole = role && PARTY_ROLE_OPTIONS.some((r) => r.value === role) ? (role as PartyRoleType) : undefined;
  const search = q?.trim();

  const parties = await prisma.party.findMany({
    where: {
      ...(validRole ? { roles: { has: validRole } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { companyName: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 500,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Parties</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Vendors, karigars, job-workers, customers, and brokers. One party can have several roles, and its roles
          decide which dropdowns it shows up in across the app.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium text-zinc-500">Search</label>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Name, company, phone"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Role</label>
              <select name="role" defaultValue={role ?? ""} className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm">
                <option value="">All</option>
                {PARTY_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Filter
            </button>
            {(role || q) && (
              <Link href="/settings/parties" className="text-sm text-zinc-500 hover:underline">
                Clear
              </Link>
            )}
          </form>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {parties.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                      No parties found.
                    </td>
                  </tr>
                )}
                {parties.map((p) => (
                  <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/settings/parties/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                        {p.name}
                      </Link>
                      {p.companyName && p.companyName !== p.name && (
                        <p className="text-xs text-zinc-500">{p.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.roles.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {p.roles.map((r) => (
                            <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-medium ${PARTY_ROLE_STYLES[r]}`}>
                              {PARTY_ROLE_LABELS[r]}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-zinc-400">No role</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActiveToggleButton partyId={p.id} active={p.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add party</h2>
          <div className="mt-4">
            <PartyForm />
          </div>
        </div>
      </div>
    </div>
  );
}
