import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { getStages } from "@/lib/process-stages";
import {
  STONE_LOCATION_LABELS,
  STONE_LOCATION_VALUES,
  STONE_STATUS_LABELS,
  STONE_STATUS_STYLES,
  STONE_STATUS_VALUES,
} from "@/lib/stone/status";
import { parseScannedCode } from "@/lib/stone/scan";
import type { Prisma, StoneLocation, StoneStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

type Search = { q?: string; status?: string; location?: string; stage?: string; page?: string };

export default async function StonesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("stones.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q ? parseScannedCode(sp.q) : "";
  const status = (STONE_STATUS_VALUES as readonly string[]).includes(sp.status ?? "") ? (sp.status as StoneStatus) : undefined;
  const location = (STONE_LOCATION_VALUES as readonly string[]).includes(sp.location ?? "")
    ? (sp.location as StoneLocation)
    : undefined;
  const stages = await getStages();
  const stageId = stages.some((s) => s.id === sp.stage) ? sp.stage : undefined;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(location ? { stockLocation: location } : {}),
    ...(stageId ? { currentStageId: stageId } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { polishedStone: { stockId: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [stones, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        currentParty: { select: { name: true } },
        currentStage: { select: { name: true } },
        locationParty: { select: { name: true } },
        polishedStone: { select: { stockId: true, shape: true, caratWeight: true } },
      },
      orderBy: [{ createdAt: "desc" }, { sku: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(next: Partial<Search>) {
    const params = new URLSearchParams(Object.entries({ ...sp, ...next }).filter(([, v]) => v) as [string, string][]);
    return `/stones?${params.toString()}`;
  }
  const selectClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base sm:py-2 sm:text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Stones</h1>
          <p className="mt-1 text-sm text-zinc-500">Every stone, from rough to sold.</p>
        </div>
        <div className="flex gap-2">
          {stones.length > 0 && (
            <Link
              href={`/stones/labels?ids=${stones.map((s) => s.id).join(",")}`}
              className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Labels for this page
            </Link>
          )}
          <Link href="/scan" className="min-h-10 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
            Scan
          </Link>
        </div>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-5 sm:items-end">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-zinc-500">Stone / Stock ID</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="e.g. LOT-2026-001" className={selectClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className={selectClass}>
            <option value="">All</option>
            {STONE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STONE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Location</label>
          <select name="location" defaultValue={location ?? ""} className={selectClass}>
            <option value="">All</option>
            {STONE_LOCATION_VALUES.map((l) => (
              <option key={l} value={l}>
                {STONE_LOCATION_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">At stage</label>
          <select name="stage" defaultValue={stageId ?? ""} className={selectClass}>
            <option value="">Any</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="min-h-10 flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Filter
          </button>
          <Link href="/stones" className="flex min-h-10 items-center px-2 text-sm text-zinc-500 hover:underline">
            Clear
          </Link>
        </div>
      </form>

      <p className="text-sm text-zinc-500">
        {total.toLocaleString("en-IN")} stone{total === 1 ? "" : "s"} · page {page} of {pages}
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Stone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Where</th>
              <th className="px-4 py-3 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {stones.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No stones match.
                </td>
              </tr>
            )}
            {stones.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/stones/${s.id}`} className="block font-mono text-xs font-medium text-zinc-900 hover:underline">
                    {s.sku}
                  </Link>
                  {s.polishedStone && (
                    <span className="text-xs text-zinc-500">
                      {s.polishedStone.stockId}
                      {s.polishedStone.shape ? ` · ${s.polishedStone.shape}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STONE_STATUS_STYLES[s.status]}`}>
                    {STONE_STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.currentStage || s.currentParty ? (
                    <>
                      {s.currentStage?.name ?? "Issued"}
                      {s.currentParty && <span className="text-zinc-400"> · {s.currentParty.name}</span>}
                    </>
                  ) : (
                    <>
                      {STONE_LOCATION_LABELS[s.stockLocation]}
                      {s.locationParty && <span className="text-zinc-400"> · {s.locationParty.name}</span>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                  {(s.polishedStone?.caratWeight ?? s.caratWeight) !== null ? `${s.polishedStone?.caratWeight ?? s.caratWeight} ct` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}
          {page < pages && (
            <Link href={href({ page: String(page + 1) })} className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              Next &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
