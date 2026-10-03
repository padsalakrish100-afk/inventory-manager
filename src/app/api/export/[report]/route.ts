import { can, getViewer, type Permission } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { formatDate } from "@/lib/dates";
import { periodBounds, rupees, unpaidPayroll } from "@/lib/karigar/payroll";
import { karigarPerformance } from "@/lib/karigar/performance";
import { prisma } from "@/lib/prisma";
import { buildExcelBuffer, excelResponse, type ExportColumn } from "@/lib/export/excel";
import { buildPdfBuffer, pdfResponse, type PdfColumn } from "@/lib/export/pdf";
import { POLISH_STATUS_LABELS, SALE_TYPE_LABELS, PAYMENT_STATUS_LABELS, daysInStock } from "@/lib/polish-status";
import { stoneCosts } from "@/lib/costing/ledger";
import { PROCESS_LABELS } from "@/lib/process";
import { formatMoney } from "@/lib/format";
import { describePolishFilters, polishWhere, readPolishFilters } from "@/lib/polish-filters";
import { STONE_LOCATION_LABELS, STONE_STATUS_LABELS } from "@/lib/stone/status";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { canRun, readFilters, REPORTS_BY_KEY, runReport } from "@/lib/reports";
import { excelFormat, formatCell, isNumeric } from "@/lib/reports/format";

type ReportResult = { title: string; subtitle?: string; columns: ExportColumn[]; rows: Record<string, string | number>[] };

// Which permission each export needs — the same as the page it comes from.
const REPORT_PERMISSIONS: Record<string, Permission> = {
  polish: "stock.view",
  "polish-aging": "stock.view",
  "polish-inventory-value": "stock.view",
  "polish-sales": "sales.reports",
  "manufacturing-reports": "mfg.reports",
  lotting: "lots.manage",
  payroll: "costs.view",
  "karigar-performance": "karigars.manage",
};

function periodFrom(searchParams: URLSearchParams) {
  const ok = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const from = ok(searchParams.get("from")) ? searchParams.get("from")! : `${today.slice(0, 8)}01`;
  const to = ok(searchParams.get("to")) ? searchParams.get("to")! : today;
  return { from, to, ...periodBounds(from, to) };
}

async function buildReport(
  report: string,
  searchParams: URLSearchParams,
  showCosts: boolean,
): Promise<ReportResult | null> {
  switch (report) {
    case "polish": {
      const filters = readPolishFilters((k) => searchParams.get(k));
      const stones = await prisma.polishedStone.findMany({
        where: polishWhere(filters),
        orderBy: { createdAt: "desc" },
        include: { sourceProduct: { select: { status: true, stockLocation: true } } },
      });
      const dec = (v: { toString(): string } | null) => (v === null ? "" : v.toString());
      return {
        title: "Polish",
        subtitle: describePolishFilters(filters),
        columns: [
          { header: "Stock ID", key: "stockId" },
          { header: "Cut style", key: "cutStyle" },
          { header: "Shape", key: "shape" },
          { header: "Carat", key: "carat" },
          { header: "Color", key: "color" },
          { header: "Clarity", key: "clarity" },
          { header: "Cut", key: "cut" },
          { header: "Polish", key: "polish" },
          { header: "Symmetry", key: "symmetry" },
          { header: "Fluorescence", key: "fluorescence" },
          { header: "L x W x D (mm)", key: "mm" },
          { header: "Table %", key: "table" },
          { header: "Depth %", key: "depth" },
          { header: "Lab", key: "lab" },
          { header: "Report no.", key: "certNumber" },
          { header: "Status", key: "status" },
          { header: "Location", key: "location" },
          { header: "Sale type", key: "saleType" },
          { header: "Asking price", key: "askingPrice" },
          { header: "Minimum price", key: "minPrice" },
          { header: "Days in stock", key: "days" },
        ],
        rows: stones.map((p) => ({
          stockId: p.stockId,
          cutStyle: p.cutStyle ? (CUT_STYLE_LABELS[p.cutStyle] ?? p.cutStyle) : "",
          shape: p.shape ?? "",
          carat: p.caratWeight ?? "",
          color: p.color ?? "",
          clarity: p.clarity ?? "",
          cut: p.cutGrade ?? "",
          polish: p.polishGrade ?? "",
          symmetry: p.symmetry ?? "",
          fluorescence: p.fluorescence ?? "",
          mm: p.lengthMm ? `${dec(p.lengthMm)} x ${dec(p.widthMm)} x ${dec(p.depthMm)}` : (p.measurements ?? ""),
          table: dec(p.tablePct),
          depth: dec(p.depthPct),
          lab: p.certLab ?? "",
          certNumber: p.certNumber ?? "",
          status: STONE_STATUS_LABELS[p.sourceProduct.status],
          location: STONE_LOCATION_LABELS[p.sourceProduct.stockLocation] + (p.location ? ` (${p.location})` : ""),
          saleType: p.saleType ? SALE_TYPE_LABELS[p.saleType] : "",
          askingPrice: p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "",
          minPrice: p.minPrice !== null ? formatMoney(Number(p.minPrice), p.currency) : "",
          days: daysInStock(p.createdAt),
        })),
      };
    }

    case "polish-aging": {
      const stones = await prisma.polishedStone.findMany({ where: { status: { not: "SOLD" } } });
      const rows = stones
        .map((p) => ({ ...p, days: daysInStock(p.createdAt) }))
        .sort((a, b) => b.days - a.days);
      return {
        title: "Stock aging",
        subtitle: "Every unsold stone, oldest first",
        columns: [
          { header: "Stock ID", key: "stockId" },
          { header: "Shape", key: "shape" },
          { header: "Carat", key: "carat" },
          { header: "Status", key: "status" },
          { header: "Location", key: "location" },
          { header: "Asking price", key: "askingPrice" },
          { header: "Days in stock", key: "days" },
        ],
        rows: rows.map((p) => ({
          stockId: p.stockId,
          shape: p.shape ?? "",
          carat: p.caratWeight ?? "",
          status: POLISH_STATUS_LABELS[p.status] ?? p.status,
          location: p.location ?? "",
          askingPrice: p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "",
          days: p.days,
        })),
      };
    }

    case "polish-inventory-value": {
      const stones = await prisma.polishedStone.findMany();
      const { POLISH_STATUS_OPTIONS } = await import("@/lib/polish-status");
      const rows = POLISH_STATUS_OPTIONS.map((s) => {
        const stonesInStatus = stones.filter((p) => p.status === s.value);
        const totals = new Map<string, number>();
        for (const p of stonesInStatus) {
          const value = s.value === "SOLD" ? p.soldPrice : p.askingPrice;
          if (value === null) continue;
          totals.set(p.currency, (totals.get(p.currency) ?? 0) + value);
        }
        return {
          status: s.label,
          count: stonesInStatus.length,
          basis: s.value === "SOLD" ? "Sold price" : "Asking price",
          total: [...totals.entries()].map(([c, t]) => formatMoney(t, c)).join(" / ") || "",
        };
      });
      return {
        title: "Inventory value summary",
        subtitle: "Total value by status",
        columns: [
          { header: "Status", key: "status" },
          { header: "Stones", key: "count" },
          { header: "Value basis", key: "basis" },
          { header: "Total value", key: "total" },
        ],
        rows,
      };
    }

    case "polish-sales": {
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const buyerId = searchParams.get("buyerId");
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      if (toDate) toDate.setHours(23, 59, 59, 999);

      const stones = await prisma.polishedStone.findMany({
        where: {
          status: "SOLD",
          buyerId: buyerId || undefined,
          soldDate: { gte: fromDate, lte: toDate },
        },
        include: { buyer: true },
        orderBy: { soldDate: "desc" },
      });
      const costs = showCosts ? await stoneCosts(prisma, stones.map((p) => p.sourceProductId)) : new Map();

      return {
        title: "Sales report",
        subtitle: [from ? `From ${from}` : null, to ? `To ${to}` : null].filter(Boolean).join(" · ") || "All sales",
        columns: [
          { header: "Stock ID", key: "stockId" },
          { header: "Buyer", key: "buyer" },
          { header: "Sold date", key: "soldDate" },
          { header: "Sold price", key: "soldPrice" },
          ...(showCosts
            ? [
                { header: "Total cost", key: "totalCost" },
                { header: "Margin", key: "margin" },
              ]
            : []),
          { header: "Payment", key: "payment" },
        ],
        rows: stones.map((p) => {
          const c = costs.get(p.sourceProductId);
          const totalCost = c ? (p.currency === "INR" ? c.inrCents : c.usdCents) / 100 : 0;
          const margin = p.soldPrice !== null ? p.soldPrice - totalCost : null;
          return {
            stockId: p.stockId,
            buyer: p.buyer?.name ?? "",
            soldDate: p.soldDate ? formatDate(p.soldDate) : "",
            soldPrice: p.soldPrice !== null ? formatMoney(p.soldPrice, p.currency) : "",
            ...(showCosts
              ? {
                  totalCost: formatMoney(totalCost, p.currency),
                  margin: margin !== null ? formatMoney(margin, p.currency) : "",
                }
              : {}),
            payment: p.paymentStatus ? PAYMENT_STATUS_LABELS[p.paymentStatus] : "",
          };
        }),
      };
    }

    case "manufacturing-reports": {
      const reworkedOnly = searchParams.get("reworkedOnly") === "1";
      const stones = await prisma.product.findMany({
        include: {
          lot: true,
          polishedStone: true,
          currentStage: { select: { name: true } },
          movements: { where: { voidedAt: null }, select: { stage: { select: { name: true } }, process: true } },
        },
        orderBy: { sku: "asc" },
      });
      const stoneRows = stones.map((s) => {
        const counts = new Map<string, number>();
        for (const m of s.movements) {
          const key = m.stage?.name ?? (m.process ? (PROCESS_LABELS[m.process] ?? m.process) : "Unknown");
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const reworked = [...counts.values()].some((c) => c > 1);
        return { stone: s, counts, reworked };
      });
      const visible = reworkedOnly ? stoneRows.filter((r) => r.reworked) : stoneRows;

      return {
        title: "Manufacturing reports — every stone",
        subtitle: reworkedOnly ? "Reworked stones only" : "All stones",
        columns: [
          { header: "Stone", key: "sku" },
          { header: "Lot", key: "lot" },
          { header: "Status", key: "status" },
          { header: "Times processed", key: "processed" },
        ],
        rows: visible.map(({ stone, counts }) => ({
          sku: stone.sku,
          lot: stone.lot?.lotNumber ?? "",
          status: stone.polishedStone
            ? "Polished"
            : stone.currentStage
              ? stone.currentStage.name
              : stone.currentProcess
                ? (PROCESS_LABELS[stone.currentProcess] ?? stone.currentProcess)
                : "Available",
          processed: [...counts.entries()].map(([name, n]) => `${name} x${n}`).join(", "),
        })),
      };
    }

    case "lotting": {
      const lots = await prisma.lot.findMany({
        include: { sourceParty: true, _count: { select: { products: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Lotting",
        columns: [
          { header: "Lot number", key: "lotNumber" },
          { header: "Source", key: "source" },
          { header: "Rough weight", key: "roughWeight" },
          { header: "Stones", key: "stones" },
          { header: "Date", key: "date" },
        ],
        rows: lots.map((lot) => ({
          lotNumber: lot.lotNumber,
          source: lot.sourceParty?.name ?? "",
          roughWeight: lot.roughWeight ?? "",
          stones: lot._count.products,
          date: formatDate(lot.createdAt),
        })),
      };
    }

    case "payroll": {
      const { from, to, start, end } = periodFrom(searchParams);
      const lines = await unpaidPayroll(prisma, start, end);
      return {
        title: "Karigar payroll (unpaid)",
        subtitle: `${from} to ${to} · INR`,
        columns: [
          { header: "Karigar", key: "name", width: 28 },
          { header: "Jobs", key: "entries" },
          { header: "Carats", key: "carats" },
          { header: "Labour", key: "labour" },
          { header: "Bonus", key: "bonus" },
          { header: "Deduction", key: "deduction" },
          { header: "Advance", key: "advance" },
          { header: "Net payable", key: "net" },
        ],
        rows: lines.map((l) => ({
          name: l.name,
          entries: l.entries,
          carats: Number(l.carats.toFixed(3)),
          labour: Number(rupees(l.labour)),
          bonus: Number(rupees(l.bonus)),
          deduction: Number(rupees(l.deduction)),
          advance: Number(rupees(l.advance)),
          net: Number(rupees(l.net)),
        })),
      };
    }

    case "karigar-performance": {
      const { from, to, start, end } = periodFrom(searchParams);
      const lines = await karigarPerformance(start, end);
      return {
        title: "Karigar performance",
        subtitle: `${from} to ${to}`,
        columns: [
          { header: "Karigar", key: "name", width: 28 },
          { header: "Returns", key: "returns" },
          { header: "Pieces", key: "pieces" },
          { header: "Carats", key: "carats" },
          { header: "Avg loss %", key: "avgLoss" },
          { header: "Excess loss", key: "excess" },
          { header: "Breakage", key: "breakage" },
          { header: "In hand now", key: "pending" },
          ...(showCosts ? [{ header: "Labour (INR)", key: "labour" }] : []),
        ],
        rows: lines.map((l) => ({
          name: l.name,
          returns: l.returns,
          pieces: l.pieces,
          carats: Number(l.caratsIssued.toFixed(3)),
          avgLoss: l.avgLossPct !== null ? Number(l.avgLossPct.toFixed(2)) : "",
          excess: l.excessCount,
          breakage: l.breakageCount,
          pending: l.pendingNow,
          ...(showCosts ? { labour: Number(l.labourInr.toFixed(2)) } : {}),
        })),
      };
    }

    default:
      return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const viewer = await getViewer();
  if (!viewer) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { report } = await params;

  // Reports from the report engine (Reports hub).
  const def = REPORTS_BY_KEY.get(report);
  if (def) {
    if (!canRun(viewer, def)) return new Response("Forbidden", { status: 403 });
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    if (format !== "xlsx" && format !== "pdf") return new Response("Invalid format — use ?format=xlsx or ?format=pdf", { status: 400 });
    const filters = readFilters(def, (k) => searchParams.get(k));
    const data = await runReport(viewer, def, filters);
    await writeAudit(prisma, viewer.id, {
      action: "EXPORT",
      entity: "Report",
      entityId: report,
      after: { format, rows: data.rows.length, filters },
    });
    const baseName = `${report}-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") {
      const columns = data.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? (isNumeric(c) ? 14 : 18), numFmt: excelFormat(c) }));
      const buffer = await buildExcelBuffer(data.title, columns, data.rows, { totals: data.totals, notes: [...(data.subtitle ? [data.subtitle] : []), ...(data.notes ?? [])] });
      return excelResponse(`${baseName}.xlsx`, buffer);
    }
    const text = (row: Record<string, string | number | null>) =>
      Object.fromEntries(data.columns.map((c) => [c.key, formatCell(c, row, { plainCurrency: true })]));
    const rows = data.rows.map(text);
    if (data.totals) rows.push(text(data.totals));
    const subtitle = [data.subtitle, ...(data.notes ?? [])].filter(Boolean).join(" · ").replaceAll("₹", "INR ");
    const buffer = await buildPdfBuffer(data.title, data.columns.map((c) => ({ header: c.header, key: c.key })), rows, subtitle);
    return pdfResponse(`${baseName}.pdf`, buffer);
  }

  const permission = REPORT_PERMISSIONS[report];
  if (!permission) return new Response("Unknown report", { status: 404 });
  if (!can(viewer, permission)) return new Response("Forbidden", { status: 403 });
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format !== "xlsx" && format !== "pdf") {
    return new Response("Invalid format — use ?format=xlsx or ?format=pdf", { status: 400 });
  }

  const data = await buildReport(report, searchParams, can(viewer, "costs.view"));
  if (!data) {
    return new Response("Unknown report", { status: 404 });
  }
  await writeAudit(prisma, viewer.id, {
    action: "EXPORT",
    entity: "Report",
    entityId: report,
    after: { format, rows: data.rows.length, filters: Object.fromEntries(searchParams) },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const baseName = `${report}-${dateStamp}`;

  if (format === "xlsx") {
    const buffer = await buildExcelBuffer(data.title, data.columns, data.rows);
    return excelResponse(`${baseName}.xlsx`, buffer);
  }

  const pdfColumns: PdfColumn[] = data.columns.map((c) => ({ header: c.header, key: c.key }));
  const buffer = await buildPdfBuffer(data.title, pdfColumns, data.rows, data.subtitle);
  return pdfResponse(`${baseName}.pdf`, buffer);
}
