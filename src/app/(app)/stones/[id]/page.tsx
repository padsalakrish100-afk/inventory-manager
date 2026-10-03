import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate, formatDateTime, daysSince } from "@/lib/dates";
import { PROCESS_LABELS } from "@/lib/process";
import { RETURN_CONDITION_LABELS, type ReturnCondition } from "@/lib/manufacturing/conditions";
import {
  MANUAL_LOCATION_VALUES,
  STONE_LOCATION_LABELS,
  STONE_STATUS_LABELS,
  STONE_STATUS_STYLES,
} from "@/lib/stone/status";
import { UndoMovementButton } from "./undo-movement-button";
import { DeleteStoneButton } from "./delete-stone-button";
import { MoveLocationForm } from "./move-location-form";

const EVENT_STYLES: Record<string, string> = {
  CREATED: "bg-zinc-400",
  ISSUE: "bg-amber-500",
  RETURN: "bg-emerald-500",
  UNDO: "bg-red-400",
  VOID: "bg-red-400",
  TRANSFER_TO_POLISH: "bg-sky-500",
  UNDO_TRANSFER: "bg-red-400",
  STATUS: "bg-indigo-500",
  LOCATION: "bg-violet-500",
  WEIGHT: "bg-zinc-500",
  BREAKAGE: "bg-red-600",
  SPLIT: "bg-fuchsia-500",
  EXCESS_REVIEWED: "bg-emerald-700",
  SOLD: "bg-zinc-900",
};

function ct(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return `${Number(Number(value).toFixed(3))} ct`;
}

// The stone hub: everything about one stone and the quick actions for it —
// where scanning a label lands.
export default async function StoneHubPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("stones.view");
  const { id } = await params;

  const stone = await prisma.product.findUnique({
    where: { id },
    include: {
      lot: { include: { sourceParty: { select: { name: true } } } },
      currentParty: { select: { name: true } },
      currentStage: { select: { name: true } },
      currentDepartment: { select: { name: true } },
      locationParty: { select: { name: true } },
      polishedStone: { select: { id: true, stockId: true, shape: true, caratWeight: true, color: true, clarity: true } },
      parent: { select: { id: true, sku: true } },
      children: { select: { id: true, sku: true, caratWeight: true, status: true }, orderBy: { sku: "asc" } },
      movements: {
        include: {
          party: { select: { name: true } },
          toDepartment: { select: { name: true } },
          stage: { select: { name: true } },
          voidedBy: { select: { name: true } },
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      },
      breakages: {
        include: { handledByParty: { select: { name: true } } },
        orderBy: { date: "desc" },
      },
      events: {
        include: { user: { select: { name: true } } },
        orderBy: [{ at: "desc" }, { createdAt: "desc" }],
        take: 300,
      },
    },
  });
  if (!stone) notFound();

  const breakagePhotos = stone.breakages.length
    ? await prisma.attachment.findMany({
        where: { entityType: "BREAKAGE", entityId: { in: stone.breakages.map((b) => b.id) }, deletedAt: null },
        select: { id: true, entityId: true },
      })
    : [];

  const canEdit = can(viewer, "stones.edit");
  const canIssue = can(viewer, "mfg.issueReturn");
  const showCosts = can(viewer, "costs.view");
  const activeMovements = stone.movements.filter((m) => !m.voidedAt);
  const openMovement = activeMovements.find((m) => !m.returnDate);
  const latestActiveId = activeMovements[0]?.id;
  const voidedIds = new Set(stone.movements.filter((m) => m.voidedAt).map((m) => m.id));
  const isOut = Boolean(stone.currentStageId || stone.currentProcess);
  const inProduction = stone.status === "IN_PRODUCTION";
  const canTransfer = canEdit && !isOut && !stone.polishedStone && inProduction;

  const roughWeight = stone.roughWeight !== null ? Number(stone.roughWeight) : null;
  const finalWeight = stone.polishedStone?.caratWeight ?? null;
  const yieldPct = roughWeight && finalWeight ? (finalWeight / roughWeight) * 100 : null;
  const outWith = openMovement?.party?.name ?? openMovement?.toDepartment?.name ?? stone.currentParty?.name;

  const buttonPrimary =
    "flex min-h-12 items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-medium text-white hover:brightness-110";
  const buttonSecondary =
    "flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-50";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all font-mono text-xl font-semibold text-zinc-900 sm:text-2xl">{stone.sku}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STONE_STATUS_STYLES[stone.status]}`}>
            {STONE_STATUS_LABELS[stone.status]}
          </span>
          {stone.polishedStone && (
            <Link
              href={`/polish/${stone.polishedStone.id}`}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:underline"
            >
              {stone.polishedStone.stockId}
            </Link>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          {stone.lot ? (
            <>
              Lot{" "}
              <Link href={`/lotting/${stone.lot.id}`} className="underline">
                {stone.lot.lotNumber}
              </Link>
              {stone.lot.sourceParty ? ` · from ${stone.lot.sourceParty.name}` : ""}
            </>
          ) : (
            "Not linked to a lot"
          )}
          {stone.parent && (
            <>
              {" · split from "}
              <Link href={`/stones/${stone.parent.id}`} className="font-mono underline">
                {stone.parent.sku}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Where it is right now */}
      <div className={`rounded-xl border p-4 ${isOut ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
        {isOut ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Out for process</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {stone.currentStage?.name ?? (stone.currentProcess ? PROCESS_LABELS[stone.currentProcess] : "—")}
              {outWith && <span className="font-normal text-zinc-600"> · {outWith}</span>}
            </p>
            {openMovement && (
              <p className="text-sm text-zinc-600">
                Since {formatDate(openMovement.issueDate)} ({daysSince(openMovement.issueDate)} days) · issued{" "}
                {ct(openMovement.issueWeight)}
                {openMovement.issuePieces > 1 ? `, ${openMovement.issuePieces} pc` : ""}
                {stone.currentDepartment ? ` · ${stone.currentDepartment.name} dept.` : ""}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Location</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {STONE_LOCATION_LABELS[stone.stockLocation]}
              {stone.locationParty && <span className="font-normal text-zinc-600"> · {stone.locationParty.name}</span>}
            </p>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {canIssue && !isOut && inProduction && (
          <Link href={`/manufacturing/issue?sku=${encodeURIComponent(stone.sku)}`} className={buttonPrimary}>
            Issue
          </Link>
        )}
        {canIssue && isOut && (
          <Link href={`/manufacturing/return?sku=${encodeURIComponent(stone.sku)}`} className={buttonPrimary}>
            Return
          </Link>
        )}
        {canEdit && !isOut && !["SOLD", "ON_MEMO", "SPLIT"].includes(stone.status) && (
          <MoveLocationForm
            stoneId={stone.id}
            current={stone.stockLocation}
            options={MANUAL_LOCATION_VALUES.map((v) => ({ value: v, label: STONE_LOCATION_LABELS[v] }))}
          />
        )}
        {canIssue && (inProduction || stone.status === "POLISHED") && (
          <Link href={`/stones/${stone.id}/breakage`} className={buttonSecondary}>
            Breakage
          </Link>
        )}
        {canEdit && !isOut && inProduction && !stone.polishedStone && (
          <Link href={`/stones/${stone.id}/split`} className={buttonSecondary}>
            Split
          </Link>
        )}
        {canTransfer && (
          <Link href={`/manufacturing/stone/${stone.id}/transfer`} className={buttonSecondary}>
            Transfer to Polish
          </Link>
        )}
        <Link href={`/stones/labels?ids=${stone.id}`} className={buttonSecondary}>
          Print label
        </Link>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Current weight" value={ct(stone.caratWeight)} />
        <Stat label="Rough weight" value={ct(roughWeight)} />
        <Stat label="Polished weight" value={ct(finalWeight)} />
        <Stat label="Yield" value={yieldPct !== null ? `${yieldPct.toFixed(1)}%` : "—"} />
      </div>

      {stone.children.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Split into</h2>
            <Link href={`/stones/labels?ids=${stone.children.map((c) => c.id).join(",")}`} className="text-sm underline">
              Labels
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {stone.children.map((c) => (
              <Link key={c.id} href={`/stones/${c.id}`} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
                <span className="font-mono">{c.sku}</span> · {ct(c.caratWeight)} · {STONE_STATUS_LABELS[c.status]}
              </Link>
            ))}
          </div>
        </section>
      )}

      {stone.breakages.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Breakage</h2>
          {stone.breakages.map((b) => (
            <div key={b.id} className="rounded-lg border border-red-200 bg-white p-3 text-sm">
              <p className="font-medium text-zinc-900">
                {b.totalLoss ? "Total loss — " : ""}
                {b.reason}
              </p>
              <p className="text-zinc-600">
                {formatDate(b.date)} · {b.weightBefore.toString()} → {b.weightAfter.toString()} ct
                {b.handledByParty ? ` · ${b.handledByParty.name}` : ""}
              </p>
              {b.notes && <p className="text-xs italic text-zinc-600">{b.notes}</p>}
              <div className="mt-2 flex gap-2">
                {breakagePhotos
                  .filter((p) => p.entityId === b.id)
                  .map((p) => (
                    <a key={p.id} href={`/api/attachments/${p.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated attachment route */}
                      <img src={`/api/attachments/${p.id}?thumb=1`} alt="Breakage photo" className="h-16 w-16 rounded-md object-cover" />
                    </a>
                  ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Timeline</h2>
        {stone.events.length === 0 ? (
          <p className="text-sm text-zinc-500">No history yet.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-zinc-200 pl-5">
            {stone.events.map((e) => {
              const voided = e.type !== "VOID" && e.refType === "ProcessMovement" && e.refId !== null && voidedIds.has(e.refId);
              const data = (e.data ?? {}) as Record<string, unknown>;
              return (
                <li key={e.id} className={`relative ${voided ? "opacity-50" : ""}`}>
                  <span
                    className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-50 ${EVENT_STYLES[e.type] ?? "bg-zinc-400"}`}
                  />
                  <p className={`text-sm font-medium text-zinc-900 ${voided ? "line-through" : ""}`}>
                    {e.summary ?? e.type}
                    {voided && <span className="ml-2 text-xs font-normal no-underline">(undone)</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(e.at)}
                    {e.user ? ` · by ${e.user.name}` : ""}
                    {e.weightBefore !== null || e.weightAfter !== null ? (
                      <>
                        {" · "}
                        {e.weightBefore !== null && e.weightAfter !== null
                          ? `${ct(e.weightBefore)} → ${ct(e.weightAfter)}`
                          : ct(e.weightAfter ?? e.weightBefore)}
                      </>
                    ) : null}
                    {typeof data.condition === "string" && data.condition !== "OK"
                      ? ` · ${RETURN_CONDITION_LABELS[data.condition as ReturnCondition] ?? data.condition}`
                      : ""}
                  </p>
                  {typeof data.reissueReason === "string" && (
                    <p className="text-xs italic text-amber-700">Reissue: {data.reissueReason}</p>
                  )}
                  {typeof data.excessReason === "string" && (
                    <p className="text-xs italic text-red-700">Excess loss reason: {data.excessReason}</p>
                  )}
                  {typeof data.note === "string" && <p className="text-xs italic text-zinc-600">{data.note}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Movement detail (with undo for mistakes) */}
      {stone.movements.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Issue / return entries</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">With</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Returned</th>
                  <th className="px-4 py-3 font-medium">Loss</th>
                  {showCosts && <th className="px-4 py-3 font-medium">Labour</th>}
                  {canEdit && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {stone.movements.map((m) => {
                  const voided = Boolean(m.voidedAt);
                  return (
                    <tr key={m.id} className={`border-b border-zinc-100 align-top last:border-0 ${voided ? "text-zinc-400" : ""}`}>
                      <td className="px-4 py-3">
                        <span className={voided ? "line-through" : "text-zinc-900"}>
                          {m.stage?.name ?? (m.process ? PROCESS_LABELS[m.process] : "—")}
                        </span>
                        {voided && (
                          <span className="block text-xs text-red-600">
                            Undone {formatDate(m.voidedAt)}
                            {m.voidedBy ? ` by ${m.voidedBy.name}` : ""}
                            {m.voidReason ? ` — ${m.voidReason}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{m.party?.name ?? m.toDepartment?.name ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(m.issueDate)}
                        <span className="block text-xs text-zinc-400">
                          {ct(m.issueWeight)}
                          {m.issuePieces > 1 ? ` · ${m.issuePieces} pc` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.returnDate ? (
                          <>
                            {formatDate(m.returnDate)}
                            <span className="block text-xs text-zinc-400">
                              {ct(m.returnWeight)}
                              {m.topsWeight ? ` + ${ct(m.topsWeight)} tops` : ""}
                            </span>
                          </>
                        ) : voided ? (
                          "—"
                        ) : (
                          <span className="text-amber-700">Out</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.lossWeight !== null ? (
                          <span className={m.isExcessLoss && !voided ? "font-medium text-red-700" : ""}>
                            {ct(m.lossWeight)}
                            <span className="block text-xs">
                              {m.lossPct !== null ? `${Number(m.lossPct).toFixed(2)}%` : ""}
                              {m.lossLimitPct !== null ? ` / ${Number(m.lossLimitPct).toFixed(2)}%` : ""}
                              {m.isExcessLoss ? " ⚠" : ""}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {showCosts && (
                        <td className="px-4 py-3">{m.laborCost !== null ? `₹${m.laborCost.toFixed(2)}` : "—"}</td>
                      )}
                      {canEdit && (
                        <td className="px-4 py-3">{!voided && m.id === latestActiveId && <UndoMovementButton movementId={m.id} />}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canEdit && stone.movements.length === 0 && !stone.polishedStone && stone.children.length === 0 && !stone.parentId && stone.breakages.length === 0 && (
        <div>
          <DeleteStoneButton productId={stone.id} lotId={stone.lotId} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
