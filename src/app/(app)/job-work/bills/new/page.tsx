import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { BillForm } from "./bill-form";

export default async function NewJobWorkBillPage({ searchParams }: { searchParams: Promise<{ party?: string }> }) {
  const viewer = await requirePagePermission("karigars.manage");
  if (!can(viewer, "costs.view")) redirect("/job-work");
  const { party: partyId } = await searchParams;
  if (!partyId) redirect("/job-work");

  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { id: true, name: true, roles: true } });
  if (!party || !party.roles.includes("JOB_WORKER")) notFound();

  const jobs = await prisma.processMovement.findMany({
    where: { partyId, returnDate: { not: null }, voidedAt: null, jobWorkBillId: null },
    include: { product: { select: { sku: true } }, stage: { select: { name: true } } },
    orderBy: { returnDate: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Bill from {party.name}</h1>
        <Link href="/job-work" className="text-sm text-zinc-500 hover:underline">
          &larr; Job-work
        </Link>
      </div>
      <BillForm
        partyId={party.id}
        jobs={jobs.map((j) => ({
          id: j.id,
          sku: j.product.sku,
          stage: j.stage?.name ?? "—",
          issueWeight: j.issueWeight,
          returnWeight: j.returnWeight,
          returnDate: j.returnDate!.toISOString(),
        }))}
      />
    </div>
  );
}
