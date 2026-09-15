export type AllocationInputProduct = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  caratWeight: number | null;
};

export type AllocationRow = {
  productId: string;
  sku: string;
  name: string;
  stock: number;
  weight: number;
  share: number;
  allocated: number;
  costPerUnit: number;
};

export type AllocationPreview = {
  basis: "carat" | "units";
  totalExpense: number;
  rows: AllocationRow[];
};

/**
 * Splits a lot's total expenses across the SKUs it produced, proportional to
 * each SKU's share of total carats (when every linked product has a carat
 * weight set) or its share of total units otherwise. Based on each
 * product's *current* stock, not units originally produced.
 */
export function computeAllocationPreview(
  totalExpense: number,
  products: AllocationInputProduct[],
): AllocationPreview | null {
  if (products.length === 0) return null;

  const useCarat = products.every((p) => p.caratWeight !== null && p.caratWeight > 0);
  const weights = products.map((p) => (useCarat ? p.stock * (p.caratWeight as number) : p.stock));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) return null;

  const rows: AllocationRow[] = products.map((p, i) => {
    const weight = weights[i];
    const share = weight / totalWeight;
    const allocated = totalExpense * share;
    const costPerUnit = p.stock > 0 ? allocated / p.stock : 0;
    return { productId: p.id, sku: p.sku, name: p.name, stock: p.stock, weight, share, allocated, costPerUnit };
  });

  return { basis: useCarat ? "carat" : "units", totalExpense, rows };
}
