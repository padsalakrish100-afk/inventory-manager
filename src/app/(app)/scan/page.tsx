import { ScanForm } from "./scan-form";

export default function ScanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Scan</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Scan a stone's barcode label (or type its SKU) to open it directly.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-5">
        <ScanForm />
      </div>
    </div>
  );
}
