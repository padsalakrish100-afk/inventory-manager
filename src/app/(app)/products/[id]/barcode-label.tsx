"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeLabel({
  sku,
  name,
  caratWeight,
}: {
  sku: string;
  name: string;
  caratWeight: number | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, sku, {
      format: "CODE128",
      width: 1.6,
      height: 40,
      fontSize: 12,
      margin: 4,
      displayValue: true,
    });
  }, [sku]);

  return (
    <div className="print-label flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white p-3">
      <p className="max-w-[220px] truncate text-xs font-medium text-zinc-700" title={name}>
        {name}
        {caratWeight !== null ? ` · ${caratWeight}ct` : ""}
      </p>
      <svg ref={svgRef} />
    </div>
  );
}

export function PrintLabelButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
    >
      Print label
    </button>
  );
}
