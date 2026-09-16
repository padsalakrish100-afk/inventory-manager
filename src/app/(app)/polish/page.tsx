import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function PolishPage({
  searchParams,
}: {
  searchParams: Promise<{ certification?: string; shape?: string }>;
}) {
  const { certification, shape } = await searchParams;

  const stones = await prisma.polishedStone.findMany({
    where: {
      certified: certification === "yes" ? true : certification === "no" ? false : undefined,
      shape: shape || undefined,
    },
    include: { sourceProduct: { include: { lot: true } } },
    orderBy: { createdAt: "desc" },
  });

  const hasFilters = Boolean(certification || shape);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Polish</h1>
        <p className="mt-1 text-sm text-zinc-500">Finished stones, each with its own Stock ID.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Certification</label>
          <select
            name="certification"
            defaultValue={certification ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="yes">Certified</option>
            <option value="no">Not certified</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Shape</label>
          <input
            type="text"
            name="shape"
            defaultValue={shape ?? ""}
            placeholder="e.g. Round"
            className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
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
              <th className="px-4 py-3 font-medium">Stock ID</th>
              <th className="px-4 py-3 font-medium">Shape</th>
              <th className="px-4 py-3 font-medium">Carat</th>
              <th className="px-4 py-3 font-medium">Color</th>
              <th className="px-4 py-3 font-medium">Clarity</th>
              <th className="px-4 py-3 font-medium">Certification</th>
              <th className="px-4 py-3 font-medium">Source stone</th>
            </tr>
          </thead>
          <tbody>
            {stones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
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
                      Nothing here yet. Transfer a stone from its{" "}
                      <Link href="/manufacturing" className="underline">
                        Manufacturing
                      </Link>{" "}
                      record once it's finished.
                    </>
                  )}
                </td>
              </tr>
            )}
            {stones.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/polish/${p.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                    {p.stockId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.shape ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.color ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.clarity ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.certified ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {p.certLab ?? "Certified"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      Not certified
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {p.sourceProduct.sku}
                  {p.sourceProduct.lot ? ` (${p.sourceProduct.lot.lotNumber})` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
