import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { DepartmentForm } from "./department-form";

export default async function DepartmentsPage() {
  await requirePagePermission("admin");

  const departments = await prisma.department.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { stages: { select: { name: true }, orderBy: { sortOrder: "asc" } } },
  });
  const nextOrder = (departments.at(-1)?.sortOrder ?? 0) + 10;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Departments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Each process stage belongs to a department, and department operators can only issue and return stones in the
          departments they&apos;re assigned to (Users page).
        </p>
        <Link href="/settings" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <DepartmentForm
            key={d.id}
            departmentId={d.id}
            stageNames={d.stages.map((s) => s.name)}
            defaults={{ name: d.name, sortOrder: d.sortOrder, active: d.active }}
          />
        ))}
      </div>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Add a department</h2>
        <DepartmentForm defaults={{ name: "", sortOrder: nextOrder, active: true }} />
      </section>
    </div>
  );
}
