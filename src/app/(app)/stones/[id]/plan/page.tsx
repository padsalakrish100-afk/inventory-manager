import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { CUT_STYLE_LABELS } from "@/lib/cuts";
import { MakeFinalButton, PlanForm } from "./plan-form";

export default async function StonePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePagePermission("stones.view");
  const canEdit = can(viewer, "plans.edit");
  const { id } = await params;

  const stone = await prisma.product.findUnique({
    where: { id },
    select: { id: true, sku: true, roughWeight: true, caratWeight: true, status: true, plans: { orderBy: { version: "desc" } } },
  });
  if (!stone) notFound();
  const files = await prisma.attachment.findMany({
    where: { entityType: "STONE_PLAN", entityId: { in: stone.plans.map((p) => p.id) }, deletedAt: null },
    select: { id: true, entityId: true, fileName: true, mime: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(stone.plans.map((p) => p.createdById))] } },
    select: { id: true, name: true },
  });
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const latest = stone.plans[0];
  const rough = stone.roughWeight !== null ? Number(stone.roughWeight) : stone.caratWeight;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Plan</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <Link href={`/stones/${stone.id}`} className="font-mono underline">
            {stone.sku}
          </Link>{" "}
          · rough {rough ?? "—"} ct
        </p>
      </div>

      {canEdit && ["IN_PRODUCTION", "POLISHED"].includes(stone.status) && (
        <PlanForm
          stoneId={stone.id}
          defaults={{
            plannedShape: latest?.plannedShape ?? "",
            plannedCutStyle: latest?.plannedCutStyle ?? "",
            expColor: latest?.expColor ?? "",
            expClarity: latest?.expClarity ?? "",
            expCut: latest?.expCut ?? "",
            currency: latest?.currency ?? "USD",
          }}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Versions</h2>
        {stone.plans.length === 0 && <p className="text-sm text-zinc-500">No plan yet.</p>}
        {stone.plans.map((p) => (
          <div key={p.id} className={`rounded-lg border bg-white p-4 ${p.isFinal ? "border-emerald-300" : "border-zinc-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-zinc-900">
                  v{p.version} · {p.plannedShape}
                  {p.plannedCutStyle ? ` · ${CUT_STYLE_LABELS[p.plannedCutStyle] ?? p.plannedCutStyle}` : ""} ·{" "}
                  {Number(p.plannedWeight).toFixed(3)} ct
                  {p.isFinal && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Final</span>}
                </p>
                <p className="text-sm text-zinc-600">
                  {[p.expColor, p.expClarity, p.expCut].filter(Boolean).join(" · ") || "No grade expectation"}
                  {p.expectedValue !== null ? ` · expected ${formatMoney(Number(p.expectedValue), p.currency)}` : ""}
                  {rough ? ` · planned yield ${((Number(p.plannedWeight) / rough) * 100).toFixed(1)}%` : ""}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatDateTime(p.createdAt)} · {userName.get(p.createdById) ?? "—"}
                </p>
                {p.notes && <p className="text-sm italic text-zinc-600">{p.notes}</p>}
              </div>
              {canEdit && !p.isFinal && <MakeFinalButton planId={p.id} />}
            </div>
            {files.filter((f) => f.entityId === p.id).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {files
                  .filter((f) => f.entityId === p.id)
                  .map((f) => (
                    <li key={f.id}>
                      <a href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" className="rounded-md border border-zinc-200 px-2 py-1 hover:bg-zinc-50">
                        {f.fileName ?? "file"}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
