import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MANUFACTURING_STAGE_OPTIONS, STAGE_LABELS, STAGE_STYLES, STAGE_VALUES } from "@/lib/stages";
import type { LotStatus } from "@/generated/prisma/client";
import { DeleteProductButton } from "../products/delete-button";

export default async function ManufacturingPage({
  searchParams,
}: {
  searchParams: Promise<{ lotId?: string; stage?: string }>;
}) {
  const { lotId, stage } = await searchParams;

  const validStage =
    stage && (STAGE_VALUES as readonly string[]).includes(stage) && stage !== "COMPLETED"
      ? (stage as LotStatus)
      : undefined;

  const [products, lots] = await Promise.all([
    prisma.product.findMany({
      where: {
        stage: validStage ?? { not: "COMPLETED" },
        lotId: lotId || undefined,
      },
      orderBy: [{ lot: { lotNumber: "asc" } }, { sku: "asc" }],
      include: {
        lot: true,
        // Ordered by createdAt (precise insert time), not date — the date
        // field is coarse and user-editable, so two steps logged on the
        // same day would otherwise tie and return an arbitrary "current" party.
        processLogs: { orderBy: { createdAt: "desc" }, take: 1, include: { party: true } },
      },
    }),
    prisma.lot.findMany({ orderBy: { lotNumber: "asc" } }),
  ]);

  const hasFilters = Boolean(lotId || stage);
  const exportParams = new URLSearchParams({ manufacturing: "1" });
  if (lotId) exportParams.set("lotId", lotId);
  if (stage) exportParams.set("stage", stage);
  const exportHref = `/api/export/products?${exportParams}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Manufacturing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Stones still in process — Galaxy scanning through certification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </a>
          <Link
            href="/products/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            Add SKU
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Lot</label>
          <select
            name="lotId"
            defaultValue={lotId ?? ""}
            className="mt-1 w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All lots</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Stage</label>
          <select
            name="stage"
            defaultValue={stage ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All in-process stages</option>
            {MANUFACTURING_STAGE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          <Link href="/manufacturing" className="text-sm text-zinc-500 hover:underline">
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
              <th className="px-4 py-3 font-medium">Lot</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Current party</th>
              <th className="px-4 py-3 font-medium">Carat</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  {hasFilters ? (
                    <>
                      No in-process stones match this filter.{" "}
                      <Link href="/manufacturing" className="underline">
                        Clear filters
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Nothing in process right now. Generate stones from a{" "}
                      <Link href="/lots" className="underline">
                        lot
                      </Link>{" "}
                      to get started.
                    </>
                  )}
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                <td className="px-4 py-3 text-zinc-900">{p.name}</td>
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[p.stage]}`}>
                    {STAGE_LABELS[p.stage]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.processLogs[0]?.party?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{p.caratWeight ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-800">
                  {p.stock} {p.unit}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/products/${p.id}`} className="text-zinc-600 hover:underline">
                      Update
                    </Link>
                    <DeleteProductButton productId={p.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
