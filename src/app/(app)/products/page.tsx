import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { DeleteProductButton } from "./delete-button";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { lot: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Products</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage the items you stock.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/export/products"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </a>
          <Link
            href="/products/import"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Import CSV
          </Link>
          <Link
            href="/products/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            Add product
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Lot</th>
              <th className="px-4 py-3 font-medium">Certification</th>
              <th className="px-4 py-3 font-medium">Carat</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Reorder level</th>
              <th className="px-4 py-3 font-medium">Stock value</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">
                  No products yet.{" "}
                  <Link href="/products/new" className="underline">
                    Add your first product
                  </Link>
                  .
                </td>
              </tr>
            )}
            {products.map((p) => {
              const low = p.stock <= p.reorderLevel;
              return (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-4 py-3 text-zinc-900">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.location ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.lot ? (
                      <Link href={`/lots/${p.lot.id}`} className="hover:underline">
                        {p.lot.lotNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.giaCertified
                          ? "rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                      }
                    >
                      {p.giaCertified ? "GIA" : "No GIA"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                  <td className={`px-4 py-3 ${low ? "font-medium text-red-600" : "text-zinc-800"}`}>
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.reorderLevel}</td>
                  <td className="px-4 py-3 text-zinc-800">{formatCurrency(p.stock * p.costPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/products/${p.id}`} className="text-zinc-600 hover:underline">
                        Edit
                      </Link>
                      <DeleteProductButton productId={p.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
