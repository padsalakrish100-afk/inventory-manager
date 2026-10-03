import { requirePagePermission } from "@/lib/authz";
import { Scanner } from "./scanner";

export default async function ScanPage() {
  await requirePagePermission("stones.view");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Scan a stone</h1>
        <p className="mt-1 text-sm text-zinc-500">Point the camera at a stone&apos;s QR code or barcode.</p>
      </div>
      <Scanner />
    </div>
  );
}
