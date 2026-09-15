import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; productId?: string; partyId?: string }>;
}) {
  const { type, productId, partyId } = await searchParams;

  const exportParams = new URLSearchParams();
  if (type) exportParams.set("type", type);
  if (productId) exportParams.set("productId", productId);
  if (partyId) exportParams.set("partyId", partyId);
  const exportHref = `/api/export/transactions${exportParams.toString() ? `?${exportParams}` : ""}`;

  const [transactions, products, parties] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        type: type === "IN" || type === "OUT" ? type : undefined,
        productId: productId || undefined,
        partyId: partyId || undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { product: true, user: true, party: true },
      take: 200,
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
  ]);

  const filteredParty = partyId ? parties.find((p) => p.id === partyId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Transactions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {filteredParty
              ? `Inward and outward movements with ${filteredParty.name}.`
              : "Inward and outward stock movements."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </a>
          <Link
            href="/transactions/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            New transaction
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Type</label>
          <select
            name="type"
            defaultValue={type ?? ""}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="IN">Inward</option>
            <option value="OUT">Outward</option>
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
        <div>
          <label className="block text-xs font-medium text-zinc-500">Party</label>
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
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No transactions match this filter.
                </td>
              </tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                  {t.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-zinc-900">{t.product.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      t.type === "IN"
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
                    }
                  >
                    {t.type === "IN" ? "Inward" : "Outward"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-800">{t.quantity}</td>
                <td className="px-4 py-3 text-zinc-500">{t.party?.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{t.reference ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{t.user.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
