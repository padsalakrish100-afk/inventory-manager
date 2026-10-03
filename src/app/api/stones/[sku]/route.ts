import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseScannedCode } from "@/lib/stone/scan";
import { resolveLossLimit } from "@/lib/manufacturing/limits";
import { isSawingStage } from "@/lib/process-stages";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Used by the Return scanner: where a scanned stone is out, what it was
// issued at, and the loss limit that will apply — so the form can show live
// loss and flag an excess before saving.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "stones.view")) return new Response("Forbidden", { status: 403 });

  const { sku } = await params;
  const product = await prisma.product.findUnique({
    where: { sku: parseScannedCode(safeDecode(sku)) },
    select: {
      id: true,
      caratWeight: true,
      currentStageId: true,
      currentProcess: true,
      movements: {
        where: { returnDate: null, voidedAt: null },
        orderBy: { issueDate: "desc" },
        take: 1,
        select: {
          issueWeight: true,
          issuePieces: true,
          issueDate: true,
          partyId: true,
          party: { select: { name: true } },
          toDepartment: { select: { name: true } },
          stage: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  const open = product?.movements[0];
  if (!product || !open || (!product.currentStageId && !product.currentProcess)) {
    return new Response("Not found or not currently issued", { status: 404 });
  }

  return Response.json({
    stage: open.stage?.name ?? null,
    isSawing: isSawingStage(open.stage),
    party: open.party?.name ?? open.toDepartment?.name ?? null,
    issueWeight: open.issueWeight,
    issuePieces: open.issuePieces,
    lossLimitPct: await resolveLossLimit(prisma, open.stage?.id ?? null, open.partyId, new Date()),
    caratWeight: product.caratWeight,
  });
}
