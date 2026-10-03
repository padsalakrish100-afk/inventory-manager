import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseScannedCode } from "@/lib/stone/scan";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Used by the Issue scanner to detect a reissue — a stone being sent to a
// stage it has already completed once before, which needs a reason instead
// of silently counting as rework — and to prefill the stone's recorded
// weight so it doesn't need retyping.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "stones.view")) return new Response("Forbidden", { status: 403 });

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: parseScannedCode(safeDecode(sku)) },
    select: {
      caratWeight: true,
      status: true,
      currentStageId: true,
      currentProcess: true,
      movements: { where: { returnDate: { not: null }, voidedAt: null }, select: { stageId: true } },
    },
  });

  if (!product) {
    return new Response("Not found", { status: 404 });
  }

  const completedStageIds = [...new Set(product.movements.map((m) => m.stageId).filter(Boolean))];

  return Response.json({
    completedStageIds,
    caratWeight: product.caratWeight,
    isOut: Boolean(product.currentStageId || product.currentProcess),
    status: product.status,
  });
}
