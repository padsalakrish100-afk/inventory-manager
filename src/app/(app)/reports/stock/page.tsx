import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function StockReportPage() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  const totalStockValueCost = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const totalStockValueSelling = products.reduce((sum, p) => sum + p.stock * p.sellingPrice, 0);
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock);

  const byLocation = new Map<string, { count: number; stock: number; value: number }>();
  for (const p of products) {
    const key = p.location ?? "Unspecified";
    const entry = byLocation.get(key) ?? { count: 0, stock: 0, value: 0 };
    entry.count += 1;
    entry.stock += p.stock;
    entry.value += p.stock * p.costPrice;
    byLocation.set(key, entry);
  }

  const gia = products.filter((p) => p.giaCertified);
  const noGia = products.filter((p) => !p.giaCertified);
  const giaValue = gia.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const noGiaValue = noGia.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">A point-in-time snapshot of everything currently in stock.</p>
        <a
          href="/api/export/products"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={String(products.length)} />
        <StatCard label="Stock value (cost)" value={formatCurrency(totalStockValueCost)} />
        <StatCard label="Stock value (selling)" value={formatCurrency(totalStockValueSelling)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <h2 className="px-5 pt-5 font-medium text-zinc-900">By location</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Products</th>
                <th className="px-5 py-3 font-medium">Units</th>
                <th className="px-5 py-3 font-medium">Value (cost)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byLocation.entries()).map(([location, e]) => (
                <tr key={location} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 text-zinc-900">{location}</td>
                  <td className="px-5 py-3 text-zinc-500">{e.count}</td>
                  <td className="px-5 py-3 text-zinc-500">{e.stock}</td>
                  <td className="px-5 py-3 text-zinc-800">{formatCurrency(e.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <h2 className="px-5 pt-5 font-medium text-zinc-900">By certification</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Certification</th>
                <th className="px-5 py-3 font-medium">Products</th>
                <th className="px-5 py-3 font-medium">Value (cost)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100">
                <td className="px-5 py-3 text-zinc-900">GIA</td>
                <td className="px-5 py-3 text-zinc-500">{gia.length}</td>
                <td className="px-5 py-3 text-zinc-800">{formatCurrency(giaValue)}</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-zinc-900">No GIA</td>
                <td className="px-5 py-3 text-zinc-500">{noGia.length}</td>
                <td className="px-5 py-3 text-zinc-800">{formatCurrency(noGiaValue)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <h2 className="px-5 pt-5 font-medium text-zinc-900">Low stock</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Reorder level</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-zinc-500">
                  All products are above their reorder level.
                </td>
              </tr>
            )}
            {lowStock.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-5 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                <td className="px-5 py-3">
                  <Link href={`/products/${p.id}`} className="text-zinc-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-5 py-3 font-medium text-red-600">
                  {p.stock} {p.unit}
                </td>
                <td className="px-5 py-3 text-zinc-500">{p.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
