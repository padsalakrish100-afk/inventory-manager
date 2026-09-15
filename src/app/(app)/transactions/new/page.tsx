import { prisma } from "@/lib/prisma";
import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage() {
  const [products, parties] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New transaction</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Record stock coming in or going out.
        </p>
      </div>
      <TransactionForm
        products={products.map((p) => ({ id: p.id, name: p.name, stock: p.stock, unit: p.unit }))}
        partyNames={parties.map((p) => p.name)}
      />
    </div>
  );
}
