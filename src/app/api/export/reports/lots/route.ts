import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

const CATEGORIES = ["ROUGH_PURCHASE", "SAWING", "CUTTING", "POLISHING", "CERTIFICATION", "OTHER"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
    include: { expenses: true, products: true },
  });

  const csv = toCsv(
    [
      "Lot Number",
      "Status",
      "Rough Weight",
      "Rough Purchase",
      "Sawing",
      "Cutting",
      "Polishing",
      "Certification",
      "Other",
      "Total Expenses",
      "SKUs Produced",
      "Current Stock Value",
      "Margin",
    ],
    lots.map((lot) => {
      const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
      for (const e of lot.expenses) byCategory[e.category] += e.amount;
      const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
      const stockValue = lot.products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);

      return [
        lot.lotNumber,
        lot.status,
        lot.roughWeight ?? "",
        byCategory.ROUGH_PURCHASE,
        byCategory.SAWING,
        byCategory.CUTTING,
        byCategory.POLISHING,
        byCategory.CERTIFICATION,
        byCategory.OTHER,
        totalExpense,
        lot.products.length,
        stockValue,
        stockValue - totalExpense,
      ];
    }),
  );

  return csvResponse(`lot-costing-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
