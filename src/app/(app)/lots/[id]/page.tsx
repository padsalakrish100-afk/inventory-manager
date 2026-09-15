import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { updateLot } from "../actions";
import { LotForm } from "../lot-form";
import { ExpenseForm } from "./expense-form";
import { DeleteExpenseButton } from "./delete-expense-button";
import { DeleteLotButton } from "./delete-lot-button";

const categoryLabel: Record<string, string> = {
  ROUGH_PURCHASE: "Rough purchase",
  SAWING: "Sawing",
  CUTTING: "Cutting",
  POLISHING: "Polishing",
  CERTIFICATION: "Certification",
  OTHER: "Other",
};

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      expenses: { orderBy: { date: "desc" } },
      products: { orderBy: { name: "asc" } },
    },
  });
  if (!lot) notFound();

  const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
  const stockValue = lot.products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const boundUpdateLot = updateLot.bind(null, lot.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lot {lot.lotNumber}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rough-to-polish tracking: every expense charged against this lot, and the SKUs it produced.
          </p>
        </div>
        <DeleteLotButton lotId={lot.id} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total expenses" value={formatCurrency(totalExpense)} />
        <StatCard label="SKUs produced" value={String(lot.products.length)} />
        <StatCard label="Current stock value" value={formatCurrency(stockValue)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Lot details</h2>
          <div className="mt-4">
            <LotForm
              action={boundUpdateLot}
              submitLabel="Save changes"
              lotNumberEditable={false}
              defaultValues={{
                lotNumber: lot.lotNumber,
                roughWeight: lot.roughWeight,
                description: lot.description,
                status: lot.status,
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add expense</h2>
          <div className="mt-4">
            <ExpenseForm lotId={lot.id} />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="px-5 pt-5 font-medium text-zinc-900">Expenses</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lot.expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-zinc-500">
                    No expenses recorded yet.
                  </td>
                </tr>
              )}
              {lot.expenses.map((e) => (
                <tr key={e.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap text-zinc-500">
                    {e.date.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-zinc-800">{categoryLabel[e.category]}</td>
                  <td className="px-5 py-3 text-zinc-500">{e.description ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-800">{formatCurrency(e.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <DeleteExpenseButton expenseId={e.id} lotId={lot.id} />
                  </td>
                </tr>
              ))}
            </tbody>
            {lot.expenses.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td colSpan={3} className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Total
                  </td>
                  <td className="px-5 py-3 font-medium text-zinc-900">{formatCurrency(totalExpense)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="px-5 pt-5 font-medium text-zinc-900">SKUs from this lot</h2>
        <p className="px-5 pb-1 text-sm text-zinc-500">
          Link a product to this lot from the product's edit page.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Cost price</th>
              </tr>
            </thead>
            <tbody>
              {lot.products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-zinc-500">
                    No SKUs linked to this lot yet.
                  </td>
                </tr>
              )}
              {lot.products.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-5 py-3">
                    <Link href={`/products/${p.id}`} className="text-zinc-900 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-800">
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{formatCurrency(p.costPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
