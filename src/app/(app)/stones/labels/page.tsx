import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { StoneLabel, type LabelSize } from "@/components/stone-label";
import { PrintLabelButton } from "@/components/barcode-label";
import { appOrigin, qrSvg, stoneUrl } from "@/lib/stone/qr";

const MAX_LABELS = 500;

type Search = { ids?: string; lot?: string; size?: string; layout?: string };

function formatCarat(value: number | null): string | null {
  return value === null ? null : `${Number(value.toFixed(3))} ct`;
}

export default async function StoneLabelsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("stones.view");
  const sp = await searchParams;
  const size: LabelSize = sp.size === "75x38" ? "75x38" : "50x25";
  const layout = sp.layout === "sheet" ? "sheet" : "roll";
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_LABELS);

  const stones = await prisma.product.findMany({
    where: sp.lot ? { lotId: sp.lot } : { id: { in: ids } },
    include: { lot: { select: { lotNumber: true } }, polishedStone: { select: { stockId: true, caratWeight: true, shape: true } } },
    orderBy: { sku: "asc" },
    take: MAX_LABELS,
  });

  const origin = await appOrigin();
  const labels = await Promise.all(
    stones.map(async (s) => ({
      id: s.id,
      code: s.sku,
      qr: await qrSvg(stoneUrl(origin, s.sku)),
      line1: s.polishedStone
        ? [s.polishedStone.stockId, s.polishedStone.shape].filter(Boolean).join(" · ")
        : s.lot?.lotNumber ?? null,
      line2: formatCarat(s.polishedStone?.caratWeight ?? s.caratWeight),
    })),
  );

  const [w, h] = size === "75x38" ? [75, 38] : [50, 25];
  const pageCss =
    layout === "roll"
      ? `@media print { @page { size: ${w}mm ${h}mm; margin: 0; } .stone-label { break-after: page; } }`
      : `@media print { @page { size: A4; margin: 8mm; } }`;

  function optionHref(next: Partial<Search>) {
    const params = new URLSearchParams(
      Object.entries({ ...sp, ...next }).filter(([, v]) => v) as [string, string][],
    );
    return `/stones/labels?${params.toString()}`;
  }
  const chip = (active: boolean) =>
    `min-h-10 rounded-md border px-3 py-2 text-sm ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`;

  return (
    <div className="flex flex-col gap-6">
      <style>{pageCss}</style>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Print labels</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {labels.length} label{labels.length === 1 ? "" : "s"}. Scanning the QR code with any phone camera opens the
            stone.
          </p>
        </div>
        <PrintLabelButton />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={optionHref({ size: "50x25" })} className={chip(size === "50x25")}>
          50 × 25 mm
        </Link>
        <Link href={optionHref({ size: "75x38" })} className={chip(size === "75x38")}>
          75 × 38 mm + barcode
        </Link>
        <span className="mx-2 w-px bg-zinc-200" />
        <Link href={optionHref({ layout: "roll" })} className={chip(layout === "roll")}>
          Sticker printer (one per label)
        </Link>
        <Link href={optionHref({ layout: "sheet" })} className={chip(layout === "sheet")}>
          A4 sheet
        </Link>
      </div>

      {labels.length === 0 ? (
        <p className="text-sm text-zinc-500">No stones selected.</p>
      ) : (
        // Page breaks don't apply inside flex containers, so roll printing
        // lays labels out as plain blocks, one per page.
        <div className={`print-labels flex flex-wrap gap-2 print:gap-0 ${layout === "roll" ? "print:block" : ""}`}>
          {labels.map((l) => (
            <div key={l.id} className="border border-dashed border-zinc-300 print:border-0">
              <StoneLabel code={l.code} qrSvg={l.qr} line1={l.line1} line2={l.line2} size={size} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
