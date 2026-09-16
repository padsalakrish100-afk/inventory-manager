import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Used by the Issue scanner to detect a reissue — a stone being sent to a
// process it has already completed (returned from) once before, which
// needs a reason instead of silently counting as unexplained rework — and
// to prefill the stone's already-recorded weight so it doesn't need retyping.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: decodeURIComponent(sku) },
    select: {
      id: true,
      caratWeight: true,
      movements: { where: { returnDate: { not: null } }, select: { process: true } },
    },
  });

  if (!product) {
    return new Response("Not found", { status: 404 });
  }

  const completedProcesses = [...new Set(product.movements.map((m) => m.process))];

  return Response.json({ completedProcesses, caratWeight: product.caratWeight });
}
