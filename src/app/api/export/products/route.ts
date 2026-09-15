import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const caratMin = searchParams.get("caratMin");
  const caratMax = searchParams.get("caratMax");
  const color = searchParams.get("color");
  const clarity = searchParams.get("clarity");
  const certification = searchParams.get("certification");
  const caratMinNum = caratMin ? Number(caratMin) : undefined;
  const caratMaxNum = caratMax ? Number(caratMax) : undefined;

  const products = await prisma.product.findMany({
    where: {
      caratWeight: {
        gte: Number.isFinite(caratMinNum) ? caratMinNum : undefined,
        lte: Number.isFinite(caratMaxNum) ? caratMaxNum : undefined,
      },
      color: color ? { equals: color, mode: "insensitive" } : undefined,
      clarity: clarity ? { equals: clarity, mode: "insensitive" } : undefined,
      giaCertified: certification === "GIA" ? true : certification === "NONGIA" ? false : undefined,
    },
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
