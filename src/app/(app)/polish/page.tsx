import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { CERT_LABELS, CERT_STYLES, CERT_OPTIONS, CertValue } from "@/lib/certification";
import { DeleteProductButton } from "../products/delete-button";

export default async function PolishPage({
  searchParams,
}: {
  searchParams: Promise<{
    caratMin?: string;
    caratMax?: string;
    color?: string;
    clarity?: string;
    certification?: string;
  }>;
}) {
  const { caratMin, caratMax, color, clarity, certification } = await searchParams;

  const caratMinNum = caratMin ? Number(caratMin) : undefined;
  const caratMaxNum = caratMax ? Number(caratMax) : undefined;
  const validCert =
    certification && (CERT_OPTIONS.map((c) => c.value) as string[]).includes(certification)
      ? (certification as CertValue)
      : undefined;

  const products = await prisma.product.findMany({
    where: {
      stage: "COMPLETED",
      caratWeight: {
        gte: Number.isFinite(caratMinNum) ? caratMinNum : undefined,
        lte: Number.isFinite(caratMaxNum) ? caratMaxNum : undefined,
      },
      color: color ? { equals: color, mode: "insensitive" } : undefined,
      clarity: clarity ? { equals: clarity, mode: "insensitive" } : undefined,
      certificationLab: validCert,
    },
    orderBy: { name: "asc" },
    include: { lot: true },
  });

  const hasFilters = Boolean(caratMin || caratMax || color || clarity || certification);

  const exportParams = new URLSearchParams({ stage: "COMPLETED" });
  if (caratMin) exportParams.set("caratMin", caratMin);
  if (caratMax) exportParams.set("caratMax", caratMax);
  if (color) exportParams.set("color", color);
  if (clarity) exportParams.set("clarity", clarity);
  if (certification) exportParams.set("certification", certification);
  const exportHref = `/api/export/products?${exportParams}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Polish</h1>
          <p className="mt-1 text-sm text-zinc-500">Finished, sellable inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
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

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Carat from</label>
          <input
            type="number"
            name="caratMin"
            min={0}
            step="0.01"
            defaultValue={caratMin ?? ""}
            className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Carat to</label>
          <input
            type="number"
            name="caratMax"
            min={0}
            step="0.01"
            defaultValue={caratMax ?? ""}
            className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Color</label>
          <input
            type="text"
            name="color"
            placeholder="e.g. F"
            defaultValue={color ?? ""}
            className="mt-1 w-20 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Clarity</label>
          <input
            type="text"
            name="clarity"
            placeholder="e.g. VS1"
            defaultValue={clarity ?? ""}
            className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Certification</label>
          <select
            name="certification"
            defaultValue={certification ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {CERT_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/polish" className="text-sm text-zinc-500 hover:underline">
            Clear filters
          </Link>
        )}
      </form>

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
              <th className="px-4 py-3 font-medium">Color</th>
              <th className="px-4 py-3 font-medium">Clarity</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Reorder level</th>
              <th className="px-4 py-3 font-medium">Stock value</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-zinc-500">
                  {hasFilters ? (
                    <>
                      No finished stones match this filter.{" "}
                      <Link href="/polish" className="underline">
                        Clear filters
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Nothing finished yet. Move a stone to "Completed" from its{" "}
                      <Link href="/manufacturing" className="underline">
                        Manufacturing
                      </Link>{" "}
                      record once it's ready to sell.
                    </>
                  )}
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CERT_STYLES[p.certificationLab]}`}>
                      {CERT_LABELS[p.certificationLab]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.color ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.clarity ?? "—"}</td>
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
