import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

const categoryLabel: Record<string, string> = {
  ROUGH_PURCHASE: "Rough purchase",
  SAWING: "Sawing",
  CUTTING: "Cutting",
  POLISHING: "Polishing",
  CERTIFICATION: "Certification",
  OTHER: "Other",
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const expenses = await prisma.lotExpense.findMany({
    orderBy: [{ lot: { lotNumber: "asc" } }, { date: "asc" }],
    include: { lot: true, party: true },
  });

  const csv = toCsv(
    [
      "Lot Number",
      "Lot Status",
      "Date",
      "Category",
      "Party",
      "Description",
      "Rate Per Carat",
      "Carat Min",
      "Carat Max",
      "Amount",
    ],
    expenses.map((e) => [
      e.lot.lotNumber,
      e.lot.status,
      e.date.toISOString().slice(0, 10),
      categoryLabel[e.category] ?? e.category,
      e.party?.name ?? "",
      e.description ?? "",
      e.ratePerCarat ?? "",
      e.caratMin ?? "",
      e.caratMax ?? "",
      e.amount,
    ]),
  );

  return csvResponse(`lot-expenses-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
