import { num, num0 } from "@/lib/decimal";
import Link from "next/link";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { daysInStock } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { STONE_LOCATION_LABELS, STONE_LOCATION_VALUES, STONE_STATUS_LABELS, STONE_STATUS_STYLES } from "@/lib/stone/status";
import { CUT_STYLES, CUT_STYLE_LABELS } from "@/lib/cuts";
import { CERT_LABS } from "@/lib/stone/certificates";
import { describePolishFilters, polishFilterParams, polishWhere, readPolishFilters } from "@/lib/polish-filters";
import { rapPricesFor } from "@/lib/rapaport-lookup";
import { vsRap } from "@/lib/rapaport";
import { usdInrOn } from "@/lib/fx";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;
const LIST_STATUSES = ["POLISHED", "AT_LAB", "IN_STOCK", "ON_MEMO", "SOLD", "RETURNED"] as const;
const SORTS: Record<string, { label: string; orderBy: Prisma.PolishedStoneOrderByWithRelationInput[] }> = {
  newest: { label: "Newest", orderBy: [{ createdAt: "desc" }] },
  oldest: { label: "Longest in stock", orderBy: [{ createdAt: "asc" }] },
  caratDesc: { label: "Carat, high to low", orderBy: [{ caratWeight: { sort: "desc", nulls: "last" } }] },
  caratAsc: { label: "Carat, low to high", orderBy: [{ caratWeight: { sort: "asc", nulls: "last" } }] },
  priceDesc: { label: "Asking, high to low", orderBy: [{ askingPrice: { sort: "desc", nulls: "last" } }] },
};
const SELECT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

// "Old Mine Cut · Cushion", without repeating a legacy shape like "Old Mine".
function cutLabel(cutStyle: string | null, shape: string | null): string {
  const cut = cutStyle ? (CUT_STYLE_LABELS[cutStyle] ?? cutStyle) : null;
  if (!cut) return shape ?? "—";
  if (!shape || cut.toLowerCase().startsWith(shape.toLowerCase())) return cut;
  return `${cut} · ${shape}`;
}

export default async function PolishPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("stock.view");
  const sp = await searchParams;
  const filters = readPolishFilters((k) => sp[k]);
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "newest";
  const page = Math.max(1, Math.min(1000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where = polishWhere(filters);

  const [total, stones, shapes] = await Promise.all([
    prisma.polishedStone.count({ where }),
    prisma.polishedStone.findMany({
      where,
      orderBy: [...SORTS[sort].orderBy, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { sourceProduct: { select: { id: true, status: true, stockLocation: true, locationParty: { select: { name: true } } } } },
    }),
    prisma.polishedStone.findMany({ where: { shape: { not: null } }, distinct: ["shape"], select: { shape: true }, orderBy: { shape: "asc" } }),
  ]);

  // First photo of each stone, for the thumbnail.
  const media = await prisma.attachment.findMany({
    where: { entityType: "STONE_MEDIA", kind: "PHOTO", deletedAt: null, entityId: { in: stones.map((s) => s.sourceProduct.id) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, entityId: true },
  });
  const photoOf = new Map<string, string>();
  for (const m of media) if (!photoOf.has(m.entityId)) photoOf.set(m.entityId, m.id);

  const [rap, usdInr] = await Promise.all([
    rapPricesFor(stones.map((s) => ({ id: s.id, shape: s.shape, cutStyle: s.cutStyle, color: s.color, clarity: s.clarity, carat: s.caratWeight }))),
    usdInrOn(prisma, new Date()),
  ]);
  const askingUsd = (p: { askingPrice: { toString(): string } | null; currency: string }) =>
    p.askingPrice === null ? null : p.currency === "INR" ? (usdInr ? num0(p.askingPrice) / Number(usdInr) : null) : num0(p.askingPrice);

  const params = polishFilterParams(filters);
  const hasFilters = params.size > 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const p = new URLSearchParams(params);
    if (sort !== "newest") p.set("sort", sort);
    if (n > 1) p.set("page", String(n));
    return `/polish${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Polish</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total.toLocaleString("en-IN")} {total === 1 ? "stone" : "stones"} · {describePolishFilters(filters)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons report="polish" params={params} />
          <Link href="/reports" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Reports
          </Link>
          <Link href="/polish/rapaport" className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            Rap list
          </Link>
        </div>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 text-xs font-medium text-zinc-500 sm:col-span-3 lg:col-span-2">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Stock ID, stone no. or report no." className={SELECT} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Status
          <select name="status" defaultValue={filters.status} className={SELECT}>
            <option value="">All</option>
            <option value="UNSOLD">Unsold</option>
            {LIST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STONE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Location
          <select name="location" defaultValue={filters.location} className={SELECT}>
            <option value="">All</option>
            {STONE_LOCATION_VALUES.map((l) => (
              <option key={l} value={l}>
                {STONE_LOCATION_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Cut style
          <select name="cutStyle" defaultValue={filters.cutStyle} className={SELECT}>
            <option value="">All</option>
            {CUT_STYLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Shape
          <select name="shape" defaultValue={filters.shape} className={SELECT}>
            <option value="">All</option>
            {shapes.map((s) => (
              <option key={s.shape!} value={s.shape!}>
                {s.shape}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Lab
          <select name="lab" defaultValue={filters.lab} className={SELECT}>
            <option value="">All</option>
            {CERT_LABS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
            <option value="NONE">No certificate</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Color
          <input name="color" defaultValue={filters.color} placeholder="e.g. G" className={SELECT} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Clarity
          <input name="clarity" defaultValue={filters.clarity} placeholder="e.g. VS1" className={SELECT} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Carat from
          <input name="ctMin" type="number" step="0.001" min={0} defaultValue={filters.ctMin} className={SELECT} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Carat to
          <input name="ctMax" type="number" step="0.001" min={0} defaultValue={filters.ctMax} className={SELECT} />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Sort
          <select name="sort" defaultValue={sort} className={SELECT}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:brightness-110">
            Filter
          </button>
          {(hasFilters || sort !== "newest") && (
            <Link href="/polish" className="text-sm text-zinc-500 hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-3 font-medium" aria-label="Photo" />
              <th className="px-3 py-3 font-medium">Stock ID</th>
              <th className="px-3 py-3 font-medium">Cut</th>
              <th className="px-3 py-3 font-medium text-right">Carat</th>
              <th className="px-3 py-3 font-medium">Color</th>
              <th className="px-3 py-3 font-medium">Clarity</th>
              <th className="px-3 py-3 font-medium">Lab</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Location</th>
              <th className="px-3 py-3 font-medium text-right">Asking</th>
              <th className="px-3 py-3 font-medium text-right">vs Rap</th>
              <th className="px-3 py-3 font-medium text-right">Days</th>
            </tr>
          </thead>
          <tbody>
            {stones.length === 0 && (
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
                      Nothing here yet. Transfer a stone from its{" "}
                      <Link href="/manufacturing" className="underline">
                        Manufacturing
                      </Link>{" "}
                      record once it&apos;s finished.
                    </>
                  )}
                </td>
              </tr>
            )}
            {stones.map((p) => {
              const st = p.sourceProduct;
              const photo = photoOf.get(st.id);
              const d = vsRap(askingUsd(p), num(p.caratWeight), rap.prices.get(p.id) ?? null);
              return (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/polish/${p.id}`} className="block h-11 w-11 overflow-hidden rounded-md bg-zinc-100">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/attachments/${photo}?thumb=1`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/polish/${p.id}`} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                      {p.stockId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{cutLabel(p.cutStyle, p.shape)}</td>
                  <td className="px-3 py-2 text-right text-zinc-800">{p.caratWeight?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.color ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.clarity ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.certLab ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STONE_STATUS_STYLES[st.status]}`}>
                      {STONE_STATUS_LABELS[st.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {STONE_LOCATION_LABELS[st.stockLocation]}
                    {st.locationParty ? <span className="text-zinc-400"> · {st.locationParty.name}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-800">
                    {p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right ${d === null ? "text-zinc-400" : d < 0 ? "text-emerald-700" : "text-amber-700"}`}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600">{daysInStock(p.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 hover:bg-zinc-50">
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="min-h-11 rounded-md border border-zinc-300 px-4 py-2.5 hover:bg-zinc-50">
              Next &rarr;
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      {rap.listDate && (
        <p className="text-xs text-zinc-500">
          vs Rap uses the list of {rap.listDate.toISOString().slice(0, 10)}; negative = below Rap.
        </p>
      )}
    </div>
  );
}
