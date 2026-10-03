import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeRole, requirePagePermission, ROLE_LABELS } from "@/lib/authz";
import { UserForm } from "./user-form";
import { DeleteUserButton } from "./delete-button";

export default async function UsersPage() {
  const viewer = await requirePagePermission("admin");

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: { departments: { include: { department: { select: { name: true } } } } },
    }),
    prisma.department.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">Who can sign in, and what each person can see and do.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const role = normalizeRole(u.role);
                return (
                  <tr key={u.id} className={`border-b border-zinc-100 last:border-0 ${u.active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="font-medium text-zinc-900 hover:underline">
                        {u.name}
                      </Link>
                      <p className="font-mono text-xs text-zinc-500">{u.username}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {ROLE_LABELS[role]}
                      {role === "MANAGER" && u.canSeeCosts && <span className="text-xs text-zinc-400"> · sees costs</span>}
                      {role === "OPERATOR" && (
                        <p className="text-xs text-zinc-400">
                          {u.departments.map((d) => d.department.name).join(", ") || "No departments"}
                        </p>
                      )}
                      {!u.active && <p className="text-xs text-red-600">Deactivated</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== viewer.id && <DeleteUserButton userId={u.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add user</h2>
          <div className="mt-4">
            <UserForm departments={departments} />
          </div>
        </div>
      </div>
    </div>
  );
}
