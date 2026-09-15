import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const partyId = searchParams.get("partyId");
  const productId = searchParams.get("productId");

  const transactions = await prisma.transaction.findMany({
    where: {
      type: "IN",
      partyId: partyId || undefined,
      productId: productId || undefined,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999`) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
    include: { product: true, party: true },
  });

  const csv = toCsv(
    ["Date", "SKU", "Product", "Supplier", "Quantity", "Unit Cost", "Total Cost", "Reference"],
    transactions.map((t) => [
      t.createdAt.toISOString().slice(0, 10),
      t.product.sku,
      t.product.name,
      t.party?.name ?? "",
      t.quantity,
      t.product.costPrice,
      t.quantity * t.product.costPrice,
      t.reference ?? "",
    ]),
  );

  return csvResponse(`purchases-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
