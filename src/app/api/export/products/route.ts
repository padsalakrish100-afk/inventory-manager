import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { lot: true },
  });

  const csv = toCsv(
    [
      "SKU",
      "Name",
      "Location",
      "Lot",
      "Certification",
      "Carat Weight",
      "Color",
      "Clarity",
      "Cut Grade",
      "Stock",
      "Unit",
      "Reorder Level",
      "Cost Price",
      "Selling Price",
      "Stock Value (Cost)",
    ],
    products.map((p) => [
      p.sku,
      p.name,
      p.location ?? "",
      p.lot?.lotNumber ?? "",
      p.giaCertified ? "GIA" : "No GIA",
      p.caratWeight ?? "",
      p.color ?? "",
      p.clarity ?? "",
      p.cutGrade ?? "",
      p.stock,
      p.unit,
      p.reorderLevel,
      p.costPrice,
      p.sellingPrice,
      p.stock * p.costPrice,
    ]),
  );

  return csvResponse(`products-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
