import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "./user-form";
import { DeleteUserButton } from "./delete-button";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage who can log in to this system.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-900">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-3 text-zinc-500">{u.role}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== session.user.id && <DeleteUserButton userId={u.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add user</h2>
          <div className="mt-4">
            <UserForm />
          </div>
        </div>
      </div>
    </div>
  );
}
