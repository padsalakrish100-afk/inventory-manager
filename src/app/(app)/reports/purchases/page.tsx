import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export default async function PurchasesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; partyId?: string; productId?: string }>;
}) {
  const { from, to, partyId, productId } = await searchParams;

  const [transactions, parties, products] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        type: "IN",
        partyId: partyId || undefined,
        productId: productId || undefined,
        createdAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(`${to}T23:59:59.999`) : undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      include: { product: true, party: true },
    }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = transactions.map((t) => ({ t, cost: t.quantity * t.product.costPrice }));
  const totalQty = rows.reduce((sum, r) => sum + r.t.quantity, 0);
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (partyId) exportParams.set("partyId", partyId);
  if (productId) exportParams.set("productId", productId);
  const exportHref = `/api/export/reports/purchases${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-500">
        Every inward transaction, valued at each product&apos;s current cost price.
      </p>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Supplier</label>
          <select
            name="partyId"
            defaultValue={partyId ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Product</label>
          <select
            name="productId"
            defaultValue={productId ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Filter
        </button>
        <a
          href={exportHref}
          className="ml-auto rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Units purchased" value={String(totalQty)} />
        <StatCard label="Total cost" value={formatCurrency(totalCost)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No purchases in this range.
                </td>
              </tr>
            )}
            {rows.map(({ t, cost }) => (
              <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                  {t.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-zinc-900">{t.product.name}</td>
                <td className="px-4 py-3 text-zinc-500">{t.party?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-800">{t.quantity}</td>
                <td className="px-4 py-3 text-zinc-800">{formatCurrency(cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
