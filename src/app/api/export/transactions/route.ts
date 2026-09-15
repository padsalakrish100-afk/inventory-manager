import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const productId = searchParams.get("productId");
  const partyId = searchParams.get("partyId");

  const transactions = await prisma.transaction.findMany({
    where: {
      type: type === "IN" || type === "OUT" ? type : undefined,
      productId: productId || undefined,
      partyId: partyId || undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { product: true, user: true, party: true },
  });

  const csv = toCsv(
    [
      "Date",
      "SKU",
      "Product",
      "Location",
      "Certification",
      "Type",
      "Quantity",
      "Unit Price",
      "Line Value",
      "Party",
      "Reference",
      "Notes",
      "Recorded By",
    ],
    transactions.map((t) => {
      const unitPrice = t.type === "IN" ? t.product.costPrice : t.product.sellingPrice;
      return [
        t.createdAt.toISOString(),
        t.product.sku,
        t.product.name,
        t.product.location ?? "",
        t.product.giaCertified ? "GIA" : "No GIA",
        t.type === "IN" ? "Inward" : "Outward",
        t.quantity,
        unitPrice,
        unitPrice * t.quantity,
        t.party?.name ?? "",
        t.reference ?? "",
        t.notes ?? "",
        t.user.name,
      ];
    }),
  );

  return csvResponse(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
