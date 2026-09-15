import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const [lots, settings] = await Promise.all([
    prisma.lot.findMany({ orderBy: { lotNumber: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Add product</h1>
        <p className="mt-1 text-sm text-zinc-500">Create a new item to track in stock.</p>
      </div>
      <ProductForm
        action={createProduct}
        submitLabel="Create product"
        lots={lots.map((l) => ({ id: l.id, lotNumber: l.lotNumber }))}
        locationSuggestions={settings.locations}
      />
    </div>
  );
}
