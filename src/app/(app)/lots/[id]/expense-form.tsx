"use client";

import { useActionState } from "react";
import { addExpense } from "../actions";

const categories = [
  { value: "ROUGH_PURCHASE", label: "Rough purchase" },
  { value: "SAWING", label: "Sawing" },
  { value: "CUTTING", label: "Cutting" },
  { value: "POLISHING", label: "Polishing" },
  { value: "CERTIFICATION", label: "Certification (GIA, etc.)" },
  { value: "OTHER", label: "Other" },
];

export function ExpenseForm({ lotId }: { lotId: string }) {
  const boundAction = addExpense.bind(null, lotId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-zinc-700">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue="OTHER"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-zinc-700">
          Amount (₹)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-zinc-700">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={today}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="e.g. Labor charge, vendor name..."
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add expense"}
      </button>
    </form>
  );
}
