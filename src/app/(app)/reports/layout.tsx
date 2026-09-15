import Link from "next/link";

const tabs = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/sales", label: "Sales" },
  { href: "/reports/purchases", label: "Purchases" },
  { href: "/reports/stock", label: "Stock" },
  { href: "/reports/lots", label: "Lot costing" },
  { href: "/reports/parties", label: "Party ledger" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Reports</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sales, purchases, stock, lot costing, and party history — all exportable.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-zinc-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
