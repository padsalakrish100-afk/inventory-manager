import { num } from "@/lib/decimal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { BreakageForm } from "./breakage-form";

export default async function BreakagePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("mfg.issueReturn");
  const { id } = await params;

  const [stone, karigars] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        caratWeight: true,
        currentStageId: true,
        currentProcess: true,
        currentParty: { select: { name: true } },
      },
    }),
    prisma.party.findMany({
      where: { roles: { hasSome: ["KARIGAR", "JOB_WORKER"] }, active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);
  if (!stone) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Record breakage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stone{" "}
          <Link href={`/stones/${stone.id}`} className="font-mono underline">
            {stone.sku}
          </Link>
        </p>
      </div>
      <BreakageForm
        stoneId={stone.id}
        currentWeight={num(stone.caratWeight)}
        karigarNames={karigars.map((k) => k.name)}
        defaultHandler={stone.currentParty?.name ?? null}
        isOut={Boolean(stone.currentStageId || stone.currentProcess)}
      />
    </div>
  );
}
