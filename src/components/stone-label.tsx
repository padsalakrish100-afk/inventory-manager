"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export type LabelSize = "50x25" | "75x38";

// One printable sticker: a QR code (opens the stone's page from any phone
// camera, and scans on the in-app scanner) plus the stone number in text.
// The larger size also carries a Code128 barcode for 1D USB scanners.
export function StoneLabel({
  code,
  qrSvg,
  line1,
  line2,
  size,
}: {
  code: string;
  qrSvg: string;
  line1?: string | null;
  line2?: string | null;
  size: LabelSize;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const withBarcode = size === "75x38";

  useEffect(() => {
    if (!withBarcode || !barcodeRef.current) return;
    JsBarcode(barcodeRef.current, code, {
      format: "CODE128",
      width: 1.2,
      height: 28,
      displayValue: false,
      margin: 0,
    });
  }, [code, withBarcode]);

  const [w, h] = size === "75x38" ? [75, 38] : [50, 25];
  const qrMm = size === "75x38" ? 24 : 21;

  return (
    <div
      className="stone-label flex overflow-hidden bg-white text-black"
      style={{ width: `${w}mm`, height: `${h}mm`, padding: "1.5mm", gap: "1.5mm" }}
    >
      <div
        className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
        style={{ width: `${qrMm}mm`, height: `${qrMm}mm` }}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: "0.8mm" }}>
        <p className="break-all font-mono font-bold leading-tight" style={{ fontSize: size === "75x38" ? "3.2mm" : "2.6mm" }}>
          {code}
        </p>
        {line1 && (
          <p className="truncate leading-tight" style={{ fontSize: "2.4mm" }}>
            {line1}
          </p>
        )}
        {line2 && (
          <p className="truncate leading-tight" style={{ fontSize: "2.4mm" }}>
            {line2}
          </p>
        )}
        {withBarcode && <svg ref={barcodeRef} style={{ width: "100%", height: "8mm" }} preserveAspectRatio="none" />}
      </div>
    </div>
  );
}
