import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { computeAllocationPreview } from "@/lib/lot-allocation";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/stages";
import { updateLot } from "../actions";
import { LotForm } from "../lot-form";
import { ExpenseForm } from "./expense-form";
import { DeleteExpenseButton } from "./delete-expense-button";
import { DeleteLotButton } from "./delete-lot-button";
import { AllocateButton } from "./allocate-button";
import { GenerateStonesForm } from "./generate-stones-form";
import { BulkStageForm } from "./bulk-stage-form";

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
  const [lot, parties, processRates] = await Promise.all([
    prisma.lot.findUnique({
      where: { id },
      include: {
        expenses: { orderBy: { date: "desc" }, include: { party: true } },
        products: { orderBy: { name: "asc" } },
      },
    }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
    prisma.processRate.findMany({
      include: { party: true },
      orderBy: [{ stage: "asc" }, { party: { name: "asc" } }],
    }),
  ]);
  if (!lot) notFound();

  const totalExpense = lot.expenses.reduce((sum, e) => sum + e.amount, 0);
  const stockValue = lot.products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const boundUpdateLot = updateLot.bind(null, lot.id);
  const allocation = computeAllocationPreview(totalExpense, lot.products);

  const yieldPct =
    lot.roughWeight && lot.roughWeight > 0 && lot.polishedWeight !== null
      ? (lot.polishedWeight / lot.roughWeight) * 100
      : null;

  const PRODUCT_DISPLAY_LIMIT = 100;
  const displayedProducts = lot.products.slice(0, PRODUCT_DISPLAY_LIMIT);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total expenses" value={formatCurrency(totalExpense)} />
        <StatCard label="SKUs produced" value={String(lot.products.length)} />
        <StatCard label="Current stock value" value={formatCurrency(stockValue)} />
        <StatCard
          label="Yield (polished / rough)"
          value={
            yieldPct !== null
              ? `${lot.polishedWeight} / ${lot.roughWeight} ct (${yieldPct.toFixed(1)}%)`
              : "—"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                polishedWeight: lot.polishedWeight,
                description: lot.description,
                status: lot.status,
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add expense</h2>
          <div className="mt-4">
            <ExpenseForm
              lotId={lot.id}
              partyNames={parties.map((p) => p.name)}
              savedRates={processRates.map((r) => ({
                id: r.id,
                stage: r.stage,
                partyName: r.party.name,
                ratePerCarat: r.ratePerCarat,
                caratMin: r.caratMin,
                caratMax: r.caratMax,
              }))}
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add polished output</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Split what this lot produced into GIA singles, non-GIA singles, and a loose parcel
            &mdash; run this once per group. Individually-tracked stones each get their own SKU;
            a loose parcel becomes one SKU with the pieces as its stock.
          </p>
          <div className="mt-4">
            <GenerateStonesForm lotId={lot.id} />
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
                <th className="px-5 py-3 font-medium">Party</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lot.expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-zinc-500">
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
                  <td className="px-5 py-3 text-zinc-500">{e.party?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-500">{e.description ?? "—"}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-zinc-500">
                    {e.ratePerCarat !== null
                      ? `${formatCurrency(e.ratePerCarat)}/ct${
                          e.caratMin !== null || e.caratMax !== null
                            ? ` (${e.caratMin ?? "0"}–${e.caratMax ?? "∞"}ct)`
                            : ""
                        }`
                      : "—"}
                  </td>
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
                  <td colSpan={5} className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
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
        <div className={`flex flex-wrap items-start justify-between gap-3 px-5 pt-5 ${allocation ? "" : "pb-5"}`}>
          <div>
            <h2 className="font-medium text-zinc-900">Cost allocation</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              {allocation
                ? `Splits the ₹${totalExpense.toLocaleString("en-IN")} in expenses above across every SKU from this lot, by ${allocation.basis === "carat" ? "each SKU's share of total carats" : "each SKU's share of total units (set carat weight on every SKU to allocate by carat instead)"}. Applying it overwrites each SKU's cost price with its allocated amount per unit.`
                : "Link at least one SKU with stock greater than zero to this lot to allocate its expenses."}
            </p>
          </div>
          {allocation && <AllocateButton lotId={lot.id} />}
        </div>

        {allocation && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Share</th>
                  <th className="px-5 py-3 font-medium">Allocated</th>
                  <th className="px-5 py-3 font-medium">New cost / unit</th>
                </tr>
              </thead>
              <tbody>
                {allocation.rows.slice(0, PRODUCT_DISPLAY_LIMIT).map((row) => (
                  <tr key={row.productId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-500">{row.sku}</td>
                    <td className="px-5 py-3 text-zinc-900">{row.name}</td>
                    <td className="px-5 py-3 text-zinc-500">{(row.share * 100).toFixed(1)}%</td>
                    <td className="px-5 py-3 text-zinc-800">{formatCurrency(row.allocated)}</td>
                    <td className="px-5 py-3 font-medium text-zinc-900">{formatCurrency(row.costPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allocation.rows.length > PRODUCT_DISPLAY_LIMIT && (
              <p className="px-5 py-3 text-xs text-zinc-500">
                Showing the first {PRODUCT_DISPLAY_LIMIT} of {allocation.rows.length} SKUs &mdash;
                applying the allocation still updates every one of them.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="font-medium text-zinc-900">SKUs from this lot</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Generate stones above for individual pieces, or link an existing product to this lot
              from the product's edit page.
            </p>
          </div>
          <BulkStageForm lotId={lot.id} skuCount={lot.products.length} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Cost price</th>
              </tr>
            </thead>
            <tbody>
              {lot.products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-zinc-500">
                    No SKUs linked to this lot yet.
                  </td>
                </tr>
              )}
              {displayedProducts.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                  <td className="px-5 py-3">
                    <Link href={`/products/${p.id}`} className="text-zinc-900 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[p.stage]}`}>
                      {STAGE_LABELS[p.stage]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-800">
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{formatCurrency(p.costPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lot.products.length > PRODUCT_DISPLAY_LIMIT && (
            <p className="px-5 py-3 text-xs text-zinc-500">
              Showing the first {PRODUCT_DISPLAY_LIMIT} of {lot.products.length} SKUs &mdash; export
              Products to CSV to see the rest.
            </p>
          )}
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
