import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: decodeURIComponent(sku) },
    include: { currentParty: true },
  });

  if (!product || !product.currentProcess) {
    return new Response("Not found or not currently issued", { status: 404 });
  }

  return Response.json({
    process: product.currentProcess,
    party: product.currentParty?.name ?? null,
    caratWeight: product.caratWeight,
  });
}
