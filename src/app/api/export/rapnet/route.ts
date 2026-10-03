import { num0 } from "@/lib/decimal";
import Papa from "papaparse";
import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { usdInrOn } from "@/lib/fx";
import { readFilters, REPORTS_BY_KEY } from "@/lib/reports";
import { verifyUrl } from "@/lib/stone/certificates";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import type { STONE_LOCATION_VALUES } from "@/lib/stone/status";

// Shape names for RapNet's upload; antique cuts map to RapNet's own names.
// RapNet's upload screen lets you re-map any value it doesn't recognise.
const RAPNET_SHAPE: Record<string, string> = {
  OLD_MINE: "Old Miner",
  OLD_EUROPEAN: "European Cut",
  ROSE: "Rose",
};

const HEADERS = [
  "Stock #",
  "Availability",
  "Shape",
  "Weight",
  "Color",
  "Clarity",
  "Cut Grade",
  "Polish",
  "Symmetry",
  "Fluorescence Intensity",
  "Measurements",
  "Lab",
  "Certificate #",
  "Certificate URL",
  "Price / Ct",
  "Total Price",
  "Depth %",
  "Table %",
  "Girdle",
  "Culet",
  "Crown Angle",
  "Crown Height",
  "Pavilion Angle",
  "Pavilion Depth",
  "Member Comments",
  "City",
  "State",
  "Country",
];

// Stock list as a RapNet-style CSV for uploading to trading platforms. Only
// stones in stock or on memo with an asking price are listed; no costs.
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "stock.view")) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const f = readFilters(REPORTS_BY_KEY.get("stock-list")!, (k) => searchParams.get(k));
  const statuses = f.status === "IN_STOCK" || f.status === "ON_MEMO" ? [f.status] : ["IN_STOCK", "ON_MEMO"];
  const [stones, fx] = await Promise.all([
    prisma.polishedStone.findMany({
      where: {
        askingPrice: { gt: 0 },
        sourceProduct: {
          status: { in: statuses as ("IN_STOCK" | "ON_MEMO")[] },
          ...(f.location ? { stockLocation: f.location as (typeof STONE_LOCATION_VALUES)[number] } : {}),
        },
        ...(f.shape ? { shape: { equals: f.shape, mode: "insensitive" as const } } : {}),
        ...(f.cutStyle ? { cutStyle: f.cutStyle } : {}),
      },
      include: { sourceProduct: { select: { status: true } } },
      orderBy: { stockId: "asc" },
      take: 20000,
    }),
    usdInrOn(prisma, new Date()),
  ]);

  const num = (v: { toString(): string } | null) => (v === null ? "" : Number(v.toString()).toString());
  const rows = stones.flatMap((p) => {
    const askingPrice = num0(p.askingPrice);
    const carats = num0(p.caratWeight);
    const asking = p.currency === "INR" ? (fx ? askingPrice / Number(fx) : null) : askingPrice;
    if (asking === null || !carats) return [];
    const shape = (p.cutStyle && RAPNET_SHAPE[p.cutStyle]) || p.shape || "";
    const comments = [p.cutStyle ? (CUT_STYLE_LABELS[p.cutStyle] ?? p.cutStyle) : null, p.shape && shape !== p.shape ? p.shape : null]
      .filter(Boolean)
      .join(", ");
    return [
      [
        p.stockId,
        p.sourceProduct.status === "ON_MEMO" ? "On Memo" : "Guaranteed Available",
        shape,
        carats.toFixed(2),
        p.color ?? "",
        p.clarity ?? "",
        p.cutGrade ?? "",
        p.polishGrade ?? "",
        p.symmetry ?? "",
        p.fluorescence ?? "",
        p.lengthMm ? `${num(p.lengthMm)}x${num(p.widthMm)}x${num(p.depthMm)}` : (p.measurements ?? ""),
        p.certLab ?? "",
        p.certNumber ?? "",
        verifyUrl(p.certLab, p.certNumber) ?? "",
        (asking / carats).toFixed(2),
        asking.toFixed(2),
        num(p.depthPct),
        num(p.tablePct),
        p.girdle ?? "",
        p.culet ?? "",
        num(p.crownAngle),
        num(p.crownHeight),
        num(p.pavilionAngle),
        num(p.pavilionDepth),
        comments,
        "Surat",
        "Gujarat",
        "India",
      ],
    ];
  });

  await writeAudit(prisma, viewer.id, { action: "EXPORT", entity: "Report", entityId: "rapnet", after: { rows: rows.length, filters: f } });
  const csv = Papa.unparse({ fields: HEADERS, data: rows });
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapnet-stock-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
