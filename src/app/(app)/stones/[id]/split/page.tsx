import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { SplitForm } from "./split-form";

export default async function SplitPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("stones.edit");
  const { id } = await params;
  const stone = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      status: true,
      caratWeight: true,
      roughWeight: true,
      currentStageId: true,
      currentProcess: true,
    },
  });
  if (!stone) notFound();
  if (stone.status !== "IN_PRODUCTION" || stone.currentStageId || stone.currentProcess) redirect(`/stones/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Split stone</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <Link href={`/stones/${stone.id}`} className="font-mono underline">
            {stone.sku}
          </Link>{" "}
          becomes several stones, each with its own number and label. Rough weight (and, once costing is on, cost) is
          shared between them by weight.
        </p>
      </div>
      <SplitForm
        stoneId={stone.id}
        sku={stone.sku}
        currentWeight={stone.caratWeight}
        roughWeight={stone.roughWeight !== null ? Number(stone.roughWeight) : null}
      />
    </div>
  );
}
