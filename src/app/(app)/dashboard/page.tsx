import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const [productCount, products, recentTransactions] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany(),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: true, user: true, party: true },
    }),
  ]);

  const lowStock = products
    .filter((p) => p.stock <= p.reorderLevel)
    .sort((a, b) => a.stock - b.stock);

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const stockValueAtCost = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const stockValueAtSelling = products.reduce((sum, p) => sum + p.stock * p.sellingPrice, 0);
  const potentialMargin = stockValueAtSelling - stockValueAtCost;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Overview of stock levels and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={productCount} />
        <StatCard label="Total units in stock" value={totalUnits} />
        <StatCard label="Low stock alerts" value={lowStock.length} accent={lowStock.length > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Stock value (cost)" value={formatCurrency(stockValueAtCost)} />
        <StatCard label="Stock value (selling)" value={formatCurrency(stockValueAtSelling)} />
        <StatCard label="Potential margin" value={formatCurrency(potentialMargin)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">All products are above their reorder level.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/products/${p.id}`} className="text-zinc-800 hover:underline">
                    {p.name} ({p.sku})
                  </Link>
                  <span className="font-medium text-red-600">
                    {p.stock} {p.unit} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Recent transactions</h2>
          {recentTransactions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No transactions yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-800">
                    {t.product.name}{" "}
                    <span className="text-zinc-400">
                      by {t.user.name} · {t.createdAt.toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={
                      t.type === "IN"
                        ? "font-medium text-emerald-600"
                        : "font-medium text-orange-600"
                    }
                  >
                    {t.type === "IN" ? "+" : "-"}
                    {t.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${accent ? "text-red-600" : "text-zinc-900"}`}>
        {value}
      </p>
    </div>
  );
}
