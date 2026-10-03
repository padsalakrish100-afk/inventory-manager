import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseScannedCode } from "@/lib/stone/scan";

// Used by the Issue scanner to detect a reissue — a stone being sent to a
// process it has already completed (returned from) once before, which
// needs a reason instead of silently counting as unexplained rework — and
// to prefill the stone's already-recorded weight so it doesn't need retyping.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "stones.view")) return new Response("Forbidden", { status: 403 });

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: parseScannedCode(decodeURIComponent(sku)) },
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
