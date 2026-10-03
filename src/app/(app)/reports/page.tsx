import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getViewer, homePathFor, type Permission } from "@/lib/authz";
import { canRun, REPORTS } from "@/lib/reports";

// Reports that live on their own pages (built in earlier phases).
const OTHER_REPORTS: { group: string; title: string; description: string; href: string; permission: Permission }[] = [
  { group: "Stock", title: "Inventory value", description: "Stock at cost and at asking price, by status and location.", href: "/costing", permission: "costs.view" },
  { group: "Manufacturing", title: "Pending with karigars", description: "Stones out now, by karigar or department, and how long.", href: "/manufacturing/pending", permission: "mfg.view" },
  { group: "Manufacturing", title: "Excess-loss alerts", description: "Returns over the allowed loss, waiting for review.", href: "/manufacturing/alerts", permission: "mfg.view" },
  { group: "Manufacturing", title: "Planned vs actual", description: "Planned weight and value against what was polished.", href: "/planning/report", permission: "mfg.reports" },
  { group: "Manufacturing", title: "Every stone's processes", description: "How many times each stone went through each stage.", href: "/manufacturing/reports", permission: "mfg.reports" },
  { group: "Manufacturing", title: "Karigar performance", description: "Pieces, carats, loss %, excess loss and breakage per karigar.", href: "/karigars/performance", permission: "karigars.manage" },
  { group: "Manufacturing", title: "Payroll", description: "Labour, advances and deductions per karigar; mark as paid.", href: "/karigars/payroll", permission: "costs.view" },
];

const GROUPS = ["Stock", "Manufacturing", "Sales", "Finance"];

export default async function ReportsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const engine = REPORTS.filter((r) => canRun(viewer, r)).map((r) => ({ group: r.group, title: r.title, description: r.description, href: `/reports/${r.key}` }));
  const other = OTHER_REPORTS.filter((r) => can(viewer, r.permission));
  const all = [...engine, ...other];
  if (all.length === 0) redirect(homePathFor(viewer));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Reports</h1>
        <p className="mt-1 text-sm text-zinc-500">Every report can be filtered and exported to Excel or PDF.</p>
      </div>
      {GROUPS.map((g) => {
        const items = all.filter((r) => r.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{g}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <Link key={r.href} href={r.href} className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50">
                  <p className="font-medium text-zinc-900">{r.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
