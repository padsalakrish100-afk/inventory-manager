import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, lots, settings] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.lot.findMany({ orderBy: { lotNumber: "asc" } }),
    getSettings(),
  ]);
  if (!product) notFound();

  const boundAction = updateProduct.bind(null, product.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Edit product</h1>
        <p className="mt-1 text-sm text-zinc-500">{product.name}</p>
      </div>
      <ProductForm
        action={boundAction}
        submitLabel="Save changes"
        lots={lots.map((l) => ({ id: l.id, lotNumber: l.lotNumber }))}
        locationSuggestions={settings.locations}
        defaultValues={{
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          stock: product.stock,
          reorderLevel: product.reorderLevel,
          location: product.location,
          giaCertified: product.giaCertified,
          caratWeight: product.caratWeight,
          color: product.color,
          clarity: product.clarity,
          cutGrade: product.cutGrade,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          lotId: product.lotId,
          stage: product.stage,
        }}
      />
    </div>
  );
}
