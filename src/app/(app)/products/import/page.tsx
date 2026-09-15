import { ImportForm } from "./import-form";

export default function ImportProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Import stock list</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a CSV of your products — new SKUs are added, existing SKUs are updated.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">Expected columns</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The header row can include any of: <code className="text-xs">SKU, Name, Location, Lot,
          Certification, Carat Weight, Color, Clarity, Cut Grade, Stock, Unit, Reorder Level,
          Cost Price, Selling Price</code>. Only SKU and Name are required — everything else is
          optional and defaults sensibly if left blank.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Not sure where to start?{" "}
          <a href="/api/export/products" className="underline">
            Export your current stock
          </a>{" "}
          as a template, edit it, and upload it back.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-zinc-200 bg-white p-5">
        <ImportForm />
      </div>
    </div>
  );
}
