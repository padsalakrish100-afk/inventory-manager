import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";

// Every breakage recorded, newest first, with photos.
export default async function BreakageListPage({ searchParams }: { searchParams: Promise<{ party?: string }> }) {
  await requirePagePermission("mfg.view");
  const { party } = await searchParams;

  const breakages = await prisma.breakage.findMany({
    where: party ? { handledByPartyId: party } : undefined,
    include: {
      stone: { select: { id: true, sku: true } },
      handledByParty: { select: { id: true, name: true } },
      recordedBy: { select: { name: true } },
      movement: { select: { stage: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
    take: 300,
  });
  const photos = await prisma.attachment.findMany({
    where: { entityType: "BREAKAGE", entityId: { in: breakages.map((b) => b.id) }, deletedAt: null },
    select: { id: true, entityId: true },
  });
  const photosBy = new Map<string, string[]>();
  for (const p of photos) photosBy.set(p.entityId, [...(photosBy.get(p.entityId) ?? []), p.id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Breakage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stones damaged in manufacturing. Record one from the stone&apos;s page (Breakage button).
          {party && (
            <>
              {" "}
              <Link href="/manufacturing/breakage" className="underline">
                Show all
              </Link>
            </>
          )}
        </p>
      </div>

      {breakages.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">No breakage recorded.</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {breakages.map((b) => {
          const lost = Number(b.weightBefore) - Number(b.weightAfter);
          return (
            <div key={b.id} className={`rounded-lg border bg-white p-4 ${b.totalLoss ? "border-red-300" : "border-zinc-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/stones/${b.stone.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:underline">
                  {b.stone.sku}
                </Link>
                <span className="text-xs text-zinc-500">{formatDate(b.date)}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {b.totalLoss ? "Total loss — " : ""}
                {b.reason}
              </p>
              <p className="text-sm text-zinc-600">
                {b.weightBefore.toString()} → {b.weightAfter.toString()} ct (−{lost.toFixed(3)} ct)
                {b.movement?.stage ? ` · during ${b.movement.stage.name}` : ""}
              </p>
              <p className="text-xs text-zinc-500">
                {b.handledByParty ? (
                  <>
                    Handled by{" "}
                    <Link href={`/manufacturing/breakage?party=${b.handledByParty.id}`} className="underline">
                      {b.handledByParty.name}
                    </Link>{" "}
                    ·{" "}
                  </>
                ) : null}
                recorded by {b.recordedBy.name}
              </p>
              {b.notes && <p className="mt-1 text-xs italic text-zinc-600">{b.notes}</p>}
              {(photosBy.get(b.id) ?? []).length > 0 && (
                <div className="mt-2 flex gap-2">
                  {photosBy.get(b.id)!.map((id) => (
                    <a key={id} href={`/api/attachments/${id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated attachment route */}
                      <img src={`/api/attachments/${id}?thumb=1`} alt="Breakage photo" className="h-16 w-16 rounded-md object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
