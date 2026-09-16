import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POLISH_STATUS_OPTIONS, POLISH_STATUS_LABELS, POLISH_STATUS_STYLES, daysInStock } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";
import type { PolishStatus } from "@/generated/prisma/client";

export default async function PolishPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const { status, sort } = await searchParams;

  const validStatus =
    status && (POLISH_STATUS_OPTIONS.map((s) => s.value) as string[]).includes(status)
      ? (status as PolishStatus)
      : undefined;

  const stones = await prisma.polishedStone.findMany({
    where: { status: validStatus },
    orderBy: { createdAt: "desc" },
  });

  const rows = stones
    .map((p) => ({ ...p, days: daysInStock(p.createdAt) }))
    .sort((a, b) => {
      if (sort === "daysAsc") return a.days - b.days;
      if (sort === "daysDesc") return b.days - a.days;
      return 0;
    });

  const hasFilters = Boolean(status);
  const nextSort = sort === "daysDesc" ? "daysAsc" : "daysDesc";
  const sortParams = new URLSearchParams();
  if (status) sortParams.set("status", status);
  sortParams.set("sort", nextSort);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Polish</h1>
          <p className="mt-1 text-sm text-zinc-500">Finished stones, each with its own Stock ID.</p>
        </div>
        <Link
          href="/polish/summary"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Summary
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {POLISH_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {sort && <input type="hidden" name="sort" value={sort} />}
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Asking price</th>
              <th className="px-4 py-3 font-medium">
                <Link href={`/polish?${sortParams}`} className="flex items-center gap-1 hover:text-zinc-900">
                  Days in stock
                  <span className="text-zinc-400">{sort === "daysAsc" ? "↑" : sort === "daysDesc" ? "↓" : ""}</span>
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
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
            {rows.map((p) => (
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${POLISH_STATUS_STYLES[p.status]}`}>
                    {POLISH_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.location ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-800">
                  {p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
