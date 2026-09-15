import Link from "next/link";

const reports = [
  {
    href: "/reports/sales",
    title: "Sales",
    description: "Outward transactions with revenue, cost, and profit — filter by date, product, or customer.",
  },
  {
    href: "/reports/purchases",
    title: "Purchases",
    description: "Inward transactions with total cost — filter by date, product, or supplier.",
  },
  {
    href: "/reports/stock",
    title: "Stock summary",
    description: "Current holdings broken down by location and certification, plus low-stock items.",
  },
  {
    href: "/reports/lots",
    title: "Lot costing",
    description: "Every lot's expenses by category against the current value of the SKUs it produced.",
  },
  {
    href: "/reports/parties",
    title: "Party ledger",
    description: "Total purchased from and sold to each supplier/customer, with last activity.",
  },
];

export default function ReportsOverviewPage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {reports.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="font-medium text-zinc-900">{r.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{r.description}</p>
        </Link>
      ))}
    </div>
  );
}
