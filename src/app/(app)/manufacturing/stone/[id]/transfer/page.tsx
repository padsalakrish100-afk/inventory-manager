import { num } from "@/lib/decimal";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { TransferForm } from "./transfer-form";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("stones.edit");
  const { id } = await params;
  const stone = await prisma.product.findUnique({ where: { id }, include: { polishedStone: true } });
  if (!stone) notFound();
  if (stone.polishedStone) redirect(`/polish/${stone.polishedStone.id}`);
  if (stone.currentProcess || stone.currentStageId || stone.status !== "IN_PRODUCTION") redirect(`/stones/${stone.id}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Transfer to Polish</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stone {stone.sku} gets a new Stock ID once transferred. Fill in what&apos;s known now — it can be edited later.
        </p>
      </div>
      <TransferForm productId={stone.id} defaultCaratWeight={num(stone.caratWeight)} />
    </div>
  );
}
