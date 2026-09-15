"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createTransaction } from "../actions";

type ProductOption = { id: string; name: string; stock: number; unit: string };

export function TransactionForm({
  products,
  partyNames,
}: {
  products: ProductOption[];
  partyNames: string[];
}) {
  const [error, formAction, pending] = useActionState(createTransaction, undefined);
  const [productId, setProductId] = useState(products[0]?.id ?? "");

  const selected = products.find((p) => p.id === productId);

  if (products.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You need at least one product before recording a transaction.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div>
        <label htmlFor="productId" className="block text-sm font-medium text-zinc-700">
          Product
        </label>
        <select
          id="productId"
          name="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1 text-xs text-zinc-500">
            Current stock: {selected.stock} {selected.unit}
          </p>
        )}
      </div>

      <div>
        <span className="block text-sm font-medium text-zinc-700">Type</span>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="type" value="IN" defaultChecked required />
            Inward (stock in)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="type" value="OUT" required />
            Outward (stock out)
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-zinc-700">
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="party" className="block text-sm font-medium text-zinc-700">
            Party (supplier / customer)
          </label>
          <Link href="/parties" className="text-xs text-zinc-500 hover:underline">
            Manage contacts
          </Link>
        </div>
        <input
          id="party"
          name="party"
          type="text"
          list="party-suggestions"
          placeholder="Type a name — new ones are saved automatically"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <datalist id="party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="reference" className="block text-sm font-medium text-zinc-700">
          Reference (invoice / PO number)
        </label>
        <input
          id="reference"
          name="reference"
          type="text"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Record transaction"}
      </button>
    </form>
  );
}
