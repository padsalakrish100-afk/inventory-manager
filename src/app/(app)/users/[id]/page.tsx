import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeRole, requirePagePermission } from "@/lib/authz";
import { EditUserForm } from "./edit-user-form";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("admin");
  const { id } = await params;

  const [user, departments] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { departments: true } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!user) notFound();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{user.name}</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{user.username}</p>
        <Link href="/users" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; All users
        </Link>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <EditUserForm
          id={user.id}
          isSelf={user.id === viewer.id}
          departments={departments}
          defaults={{
            name: user.name,
            email: user.email,
            active: user.active,
            role: normalizeRole(user.role),
            canSeeCosts: user.canSeeCosts,
            departmentIds: user.departments.map((d) => d.departmentId),
          }}
        />
      </div>
    </div>
  );
}
