import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { GeneralSettingsForm } from "./general-settings-form";

const LINKS = [
  { href: "/settings/parties", title: "Parties", description: "Vendors, karigars, job-workers, customers, brokers." },
  { href: "/settings/stages", title: "Process stages", description: "The manufacturing steps, their order and department." },
  { href: "/settings/departments", title: "Departments", description: "Factory departments that operators are assigned to." },
  { href: "/settings/loss-limits", title: "Loss limits", description: "Allowed loss % per stage, and per karigar." },
  { href: "/settings/fx", title: "Exchange rates", description: "Daily USD/INR rate stored on every money entry." },
  { href: "/users", title: "Users", description: "Logins, roles, cost visibility, departments." },
  { href: "/admin/audit", title: "Audit log", description: "Every change: who, when, old → new." },
];

export default async function SettingsPage() {
  await requirePagePermission("admin");
  const setting = await prisma.setting.findUnique({ where: { id: "singleton" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Admin-only configuration.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <p className="font-medium text-zinc-900">{l.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{l.description}</p>
          </Link>
        ))}
      </div>

      <section className="max-w-md rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">General</h2>
        <div className="mt-4">
          <GeneralSettingsForm pendingAlertDays={setting?.pendingAlertDays ?? 7} />
        </div>
      </section>
    </div>
  );
}
