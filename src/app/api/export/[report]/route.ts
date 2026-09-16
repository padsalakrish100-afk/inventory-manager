import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildExcelBuffer, excelResponse, type ExportColumn } from "@/lib/export/excel";
import { buildPdfBuffer, pdfResponse, type PdfColumn } from "@/lib/export/pdf";
import { POLISH_STATUS_LABELS, SALE_TYPE_LABELS, PAYMENT_STATUS_LABELS, daysInStock, computeTotalCost } from "@/lib/polish-status";
import { PROCESS_LABELS, PROCESS_OPTIONS } from "@/lib/process";
import { formatMoney } from "@/lib/format";
import type { PolishStatus } from "@/generated/prisma/client";

type ReportResult = { title: string; subtitle?: string; columns: ExportColumn[]; rows: Record<string, string | number>[] };

async function buildReport(report: string, searchParams: URLSearchParams): Promise<ReportResult | null> {
  switch (report) {
    case "polish": {
      const status = searchParams.get("status") ?? undefined;
      const stones = await prisma.polishedStone.findMany({
        where: status ? { status: status as PolishStatus } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Polish",
        subtitle: status ? `Status: ${POLISH_STATUS_LABELS[status] ?? status}` : "All stones",
        columns: [
          { header: "Stock ID", key: "stockId" },
          { header: "Shape", key: "shape" },
          { header: "Carat", key: "carat" },
          { header: "Color", key: "color" },
          { header: "Clarity", key: "clarity" },
          { header: "Status", key: "status" },
          { header: "Location", key: "location" },
          { header: "Sale type", key: "saleType" },
          { header: "Asking price", key: "askingPrice" },
          { header: "Days in stock", key: "days" },
        ],
        rows: stones.map((p) => ({
          stockId: p.stockId,
          shape: p.shape ?? "",
          carat: p.caratWeight ?? "",
          color: p.color ?? "",
          clarity: p.clarity ?? "",
          status: POLISH_STATUS_LABELS[p.status] ?? p.status,
          location: p.location ?? "",
          saleType: p.saleType ? SALE_TYPE_LABELS[p.saleType] : "",
          askingPrice: p.askingPrice !== null ? formatMoney(p.askingPrice, p.currency) : "",
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

      return {
        title: "Sales report",
        subtitle: [from ? `From ${from}` : null, to ? `To ${to}` : null].filter(Boolean).join(" · ") || "All sales",
        columns: [
          { header: "Stock ID", key: "stockId" },
          { header: "Buyer", key: "buyer" },
          { header: "Sold date", key: "soldDate" },
          { header: "Sold price", key: "soldPrice" },
          { header: "Total cost", key: "totalCost" },
          { header: "Margin", key: "margin" },
          { header: "Payment", key: "payment" },
        ],
        rows: stones.map((p) => {
          const totalCost = computeTotalCost(p);
          const margin = p.soldPrice !== null ? p.soldPrice - totalCost : null;
          return {
            stockId: p.stockId,
            buyer: p.buyer?.name ?? "",
            soldDate: p.soldDate ? p.soldDate.toLocaleDateString() : "",
            soldPrice: p.soldPrice !== null ? formatMoney(p.soldPrice, p.currency) : "",
            totalCost: formatMoney(totalCost, p.currency),
            margin: margin !== null ? formatMoney(margin, p.currency) : "",
            payment: p.paymentStatus ? PAYMENT_STATUS_LABELS[p.paymentStatus] : "",
          };
        }),
      };
    }

    case "manufacturing-reports": {
      const reworkedOnly = searchParams.get("reworkedOnly") === "1";
      const stones = await prisma.product.findMany({
        include: { lot: true, polishedStone: true, movements: true },
        orderBy: { sku: "asc" },
      });
      const stoneRows = stones.map((s) => {
        const counts = new Map<string, number>();
        for (const m of s.movements) counts.set(m.process, (counts.get(m.process) ?? 0) + 1);
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
            : stone.currentProcess
              ? (PROCESS_LABELS[stone.currentProcess] ?? stone.currentProcess)
              : "Available",
          processed:
            counts.size === 0
              ? ""
              : PROCESS_OPTIONS.filter((p) => counts.has(p.value))
                  .map((p) => `${p.label} x${counts.get(p.value)}`)
                  .join(", "),
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
          date: lot.createdAt.toLocaleDateString(),
        })),
      };
    }

    default:
      return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { report } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format !== "xlsx" && format !== "pdf") {
    return new Response("Invalid format — use ?format=xlsx or ?format=pdf", { status: 400 });
  }

  const data = await buildReport(report, searchParams);
  if (!data) {
    return new Response("Unknown report", { status: 404 });
  }

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
