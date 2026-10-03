import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseScannedCode } from "@/lib/stone/scan";

// Used by the Return scanner: where a scanned stone is currently out.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "stones.view")) return new Response("Forbidden", { status: 403 });

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: parseScannedCode(decodeURIComponent(sku)) },
    select: {
      currentProcess: true,
      caratWeight: true,
      currentParty: { select: { name: true } },
      currentStage: { select: { name: true } },
    },
  });

  if (!product || !product.currentProcess) {
    return new Response("Not found or not currently issued", { status: 404 });
  }

  return Response.json({
    process: product.currentProcess,
    stage: product.currentStage?.name ?? null,
    party: product.currentParty?.name ?? null,
    caratWeight: product.caratWeight,
  });
}
