import "server-only";
import QRCode from "qrcode";
import { headers } from "next/headers";

// The public origin this request came in on, so a printed QR code opens the
// same deployment it was printed from. APP_URL overrides it when set.
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function stoneUrl(origin: string, code: string): string {
  return `${origin}/s/${encodeURIComponent(code)}`;
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}
