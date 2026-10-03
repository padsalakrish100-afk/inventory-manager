import "server-only";
import { prisma } from "@/lib/prisma";
import { usdInrOn } from "@/lib/fx";
import { daysSince } from "@/lib/dates";
import { stoneCosts } from "@/lib/costing/ledger";
import { rapPricesFor } from "@/lib/rapaport-lookup";
import { vsRap } from "@/lib/rapaport";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { STONE_LOCATION_LABELS, STONE_LOCATION_VALUES, STONE_STATUS_LABELS } from "@/lib/stone/status";
import { r2, r3 } from "@/lib/reports/format";
import type { Filters, ReportResult, ReportRow } from "@/lib/reports/types";
import { groupBy, sum, toUsd, UNSOLD_STATUSES, type ReportDef } from "@/lib/reports/common";

const STATUS_CHOICES = UNSOLD_STATUSES.map((s) => ({ value: s, label: STONE_STATUS_LABELS[s] }));
const LOCATION_CHOICES = STONE_LOCATION_VALUES.filter((l) => l !== "SOLD").map((l) => ({ value: l, label: STONE_LOCATION_LABELS[l] }));

const AGE_BANDS = [
  { label: "0–30 days", max: 30 },
  { label: "31–90 days", max: 90 },
  { label: "91–180 days", max: 180 },
  { label: "181–365 days", max: 365 },
  { label: "Over a year", max: Infinity },
];
const ageBand = (days: number) => AGE_BANDS.find((b) => days <= b.max)!.label;

// Unsold polished stones matching the stock filters.
async function unsoldStock(f: Filters) {
  const status = f.status && (UNSOLD_STATUSES as readonly string[]).includes(f.status) ? f.status : null;
  return prisma.polishedStone.findMany({
    where: {
      sourceProduct: {
        status: status ? (status as (typeof UNSOLD_STATUSES)[number]) : { in: [...UNSOLD_STATUSES] },
        ...(f.location ? { stockLocation: f.location as (typeof STONE_LOCATION_VALUES)[number] } : {}),
      },
      ...(f.shape ? { shape: { equals: f.shape, mode: "insensitive" as const } } : {}),
      ...(f.cutStyle ? { cutStyle: f.cutStyle } : {}),
    },
    include: { sourceProduct: { select: { id: true, status: true, stockLocation: true, locationParty: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 20000,
  });
}

type StockStone = Awaited<ReturnType<typeof unsoldStock>>[number];

function cutLabel(p: StockStone): string {
  return p.cutStyle ? (CUT_STYLE_LABELS[p.cutStyle] ?? p.cutStyle) : "";
}

function locationLabel(p: StockStone): string {
  const s = p.sourceProduct;
  return STONE_LOCATION_LABELS[s.stockLocation] + (s.locationParty ? ` — ${s.locationParty.name}` : "");
}

export const stockAging: ReportDef = {
  key: "stock-aging",
  title: "Stock aging",
  description: "How long each unsold polished stone has been in stock, oldest first.",
  group: "Stock",
  permissions: ["stock.view"],
  filters: ["status", "location", "cutStyle", "shape", "groupBy"],
  choices: {
    status: STATUS_CHOICES,
    location: LOCATION_CHOICES,
    groupBy: [
      { value: "", label: "Each stone" },
      { value: "band", label: "Age band" },
    ],
  },
  async build(f, ctx): Promise<ReportResult> {
    const stones = await unsoldStock(f);
    const fx = await usdInrOn(prisma, new Date());
    const costs = ctx.showCosts ? await stoneCosts(prisma, stones.map((p) => p.sourceProduct.id)) : null;
    const now = new Date();
    const rows = stones.map((p) => {
      const days = daysSince(p.createdAt, now);
      return {
        p,
        days,
        band: ageBand(days),
        askingUsd: p.askingPrice !== null ? toUsd(p.askingPrice, p.currency, fx ? Number(fx) : null) : null,
        costUsd: costs ? (costs.get(p.sourceProduct.id)?.usdCents ?? 0) / 100 : null,
      };
    });
    const totals = {
      stones: rows.length,
      carats: r3(sum(rows, (r) => r.p.caratWeight)),
      askingUsd: r2(sum(rows, (r) => r.askingUsd)),
      costUsd: ctx.showCosts ? r2(sum(rows, (r) => r.costUsd)) : null,
    };

    if (f.groupBy === "band") {
      const groups = groupBy(rows, (r) => r.band);
      return {
        title: "Stock aging by age band",
        subtitle: "Unsold polished stones",
        columns: [
          { key: "band", header: "Age" },
          { key: "stones", header: "Stones", kind: "int" },
          { key: "carats", header: "Carats", kind: "carat" },
          { key: "askingUsd", header: "Asking (USD)", kind: "money", currency: "USD" },
          { key: "costUsd", header: "Cost (USD)", kind: "money", currency: "USD", costOnly: true },
        ],
        rows: AGE_BANDS.filter((b) => groups.has(b.label)).map((b) => {
          const g = groups.get(b.label)!;
          return {
            band: b.label,
            stones: g.length,
            carats: r3(sum(g, (r) => r.p.caratWeight)),
            askingUsd: r2(sum(g, (r) => r.askingUsd)),
            costUsd: ctx.showCosts ? r2(sum(g, (r) => r.costUsd)) : null,
          };
        }),
        totals: { band: "Total", ...totals },
      };
    }

    return {
      title: "Stock aging",
      subtitle: "Unsold polished stones, oldest first · days since transfer to Polish",
      columns: [
        { key: "stockId", header: "Stock ID", hrefKey: "href" },
        { key: "cut", header: "Cut" },
        { key: "shape", header: "Shape" },
        { key: "carats", header: "Carats", kind: "carat" },
        { key: "color", header: "Color" },
        { key: "clarity", header: "Clarity" },
        { key: "status", header: "Status" },
        { key: "location", header: "Location", width: 26 },
        { key: "days", header: "Days", kind: "int" },
        { key: "band", header: "Age" },
        { key: "askingUsd", header: "Asking (USD)", kind: "money", currency: "USD" },
        { key: "costUsd", header: "Cost (USD)", kind: "money", currency: "USD", costOnly: true },
      ],
      rows: rows
        .sort((a, b) => b.days - a.days)
        .map((r): ReportRow => ({
          stockId: r.p.stockId,
          href: `/polish/${r.p.id}`,
          cut: cutLabel(r.p),
          shape: r.p.shape ?? "",
          carats: r.p.caratWeight,
          color: r.p.color ?? "",
          clarity: r.p.clarity ?? "",
          status: STONE_STATUS_LABELS[r.p.sourceProduct.status],
          location: locationLabel(r.p),
          days: r.days,
          band: r.band,
          askingUsd: r.askingUsd !== null ? r2(r.askingUsd) : null,
          costUsd: r.costUsd !== null ? r2(r.costUsd) : null,
        })),
      totals: { stockId: `${totals.stones} stones`, carats: totals.carats, askingUsd: totals.askingUsd, costUsd: totals.costUsd },
      notes: fx ? [`INR asking prices converted at ₹${fx} per $.`] : undefined,
    };
  },
};

export const stockList: ReportDef = {
  key: "stock-list",
  title: "Stock list",
  description: "Unsold polished stones with full grading, certificate, asking price and Rap discount.",
  group: "Stock",
  permissions: ["stock.view"],
  filters: ["status", "location", "cutStyle", "shape"],
  choices: { status: STATUS_CHOICES, location: LOCATION_CHOICES },
  async build(f, ctx): Promise<ReportResult> {
    const stones = await unsoldStock(f);
    const [fx, rap, costs] = await Promise.all([
      usdInrOn(prisma, new Date()),
      rapPricesFor(stones.map((p) => ({ id: p.id, shape: p.shape, cutStyle: p.cutStyle, color: p.color, clarity: p.clarity, carat: p.caratWeight }))),
      ctx.showCosts ? stoneCosts(prisma, stones.map((p) => p.sourceProduct.id)) : null,
    ]);
    const dec = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));
    const rows = stones.map((p) => {
      const askingUsd = p.askingPrice !== null ? toUsd(p.askingPrice, p.currency, fx ? Number(fx) : null) : null;
      const rapPerCt = rap.prices.get(p.id) ?? null;
      const d = vsRap(askingUsd, p.caratWeight, rapPerCt);
      return {
        stockId: p.stockId,
        href: `/polish/${p.id}`,
        cut: cutLabel(p),
        shape: p.shape ?? "",
        carats: p.caratWeight,
        color: p.color ?? "",
        clarity: p.clarity ?? "",
        cutGrade: p.cutGrade ?? "",
        polish: p.polishGrade ?? "",
        symmetry: p.symmetry ?? "",
        fluorescence: p.fluorescence ?? "",
        measurements: p.lengthMm ? `${dec(p.lengthMm)} x ${dec(p.widthMm)} x ${dec(p.depthMm)}` : (p.measurements ?? ""),
        table: dec(p.tablePct),
        depth: dec(p.depthPct),
        lab: p.certLab ?? "",
        certNumber: p.certNumber ?? "",
        status: STONE_STATUS_LABELS[p.sourceProduct.status],
        location: locationLabel(p),
        askingUsd: askingUsd !== null ? r2(askingUsd) : null,
        perCtUsd: askingUsd !== null && p.caratWeight ? r2(askingUsd / p.caratWeight) : null,
        rapPerCt,
        vsRap: d !== null ? r2(d) : null,
        costUsd: costs ? r2((costs.get(p.sourceProduct.id)?.usdCents ?? 0) / 100) : null,
      } satisfies ReportRow;
    });
    return {
      title: "Stock list",
      subtitle: `${rows.length} unsold polished stones`,
      columns: [
        { key: "stockId", header: "Stock ID", hrefKey: "href" },
        { key: "cut", header: "Cut" },
        { key: "shape", header: "Shape" },
        { key: "carats", header: "Carats", kind: "carat" },
        { key: "color", header: "Color" },
        { key: "clarity", header: "Clarity" },
        { key: "cutGrade", header: "Cut grade" },
        { key: "polish", header: "Polish" },
        { key: "symmetry", header: "Sym." },
        { key: "fluorescence", header: "Fluor." },
        { key: "measurements", header: "L x W x D mm", width: 20 },
        { key: "table", header: "Table %", kind: "pct" },
        { key: "depth", header: "Depth %", kind: "pct" },
        { key: "lab", header: "Lab" },
        { key: "certNumber", header: "Report no.", width: 16 },
        { key: "status", header: "Status" },
        { key: "location", header: "Location", width: 24 },
        { key: "perCtUsd", header: "Asking $/ct", kind: "money", currency: "USD" },
        { key: "askingUsd", header: "Asking (USD)", kind: "money", currency: "USD" },
        { key: "rapPerCt", header: "Rap $/ct", kind: "money", currency: "USD" },
        { key: "vsRap", header: "vs Rap %", kind: "pct" },
        { key: "costUsd", header: "Cost (USD)", kind: "money", currency: "USD", costOnly: true },
      ],
      rows,
      totals: {
        stockId: `${rows.length} stones`,
        carats: r3(sum(rows, (r) => r.carats)),
        askingUsd: r2(sum(rows, (r) => r.askingUsd)),
        costUsd: ctx.showCosts ? r2(sum(rows, (r) => r.costUsd)) : null,
      },
      notes: [
        ...(fx ? [`INR asking prices converted at ₹${fx} per $.`] : []),
        ...(rap.listDate ? [`Rap prices from the list of ${rap.listDate.toISOString().slice(0, 10)}.`] : []),
      ],
    };
  },
};
