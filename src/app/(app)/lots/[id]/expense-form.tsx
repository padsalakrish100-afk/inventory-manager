"use client";

import { useActionState, useState } from "react";
import { addExpense } from "../actions";

const categories = [
  { value: "ROUGH_PURCHASE", label: "Rough purchase" },
  { value: "SAWING", label: "Sawing" },
  { value: "CUTTING", label: "Cutting" },
  { value: "POLISHING", label: "Polishing" },
  { value: "CERTIFICATION", label: "Certification (GIA, etc.)" },
  { value: "OTHER", label: "Other" },
];

export function ExpenseForm({ lotId, partyNames }: { lotId: string; partyNames: string[] }) {
  const boundAction = addExpense.bind(null, lotId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [mode, setMode] = useState<"flat" | "rate">("flat");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <span className="block text-sm font-medium text-zinc-700">How to enter this expense</span>
        <div className="mt-1 flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="mode"
              value="flat"
              checked={mode === "flat"}
              onChange={() => setMode("flat")}
              className="mt-0.5"
            />
            <span>A flat amount</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="mode"
              value="rate"
              checked={mode === "rate"}
              onChange={() => setMode("rate")}
              className="mt-0.5"
            />
            <span>
              A rate per carat &mdash; e.g. &#8377;50/ct for every stone in a carat range &mdash;
              calculated automatically from this lot's SKUs
            </span>
          </label>
        </div>
      </div>

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
        <label htmlFor="party" className="block text-sm font-medium text-zinc-700">
          Party (vendor, karigar, lab...)
        </label>
        <input
          id="party"
          name="party"
          type="text"
          list="expense-party-suggestions"
          placeholder="Type a name — new ones are saved automatically"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <datalist id="expense-party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {mode === "flat" ? (
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
            required={mode === "flat"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="ratePerCarat" className="block text-sm font-medium text-zinc-700">
              Rate per carat (₹)
            </label>
            <input
              id="ratePerCarat"
              name="ratePerCarat"
              type="number"
              min={0}
              step="0.01"
              required={mode === "rate"}
              placeholder="e.g. 50"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="caratMin" className="block text-sm font-medium text-zinc-700">
                Carat from
              </label>
              <input
                id="caratMin"
                name="caratMin"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 1"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="caratMax" className="block text-sm font-medium text-zinc-700">
                Carat to
              </label>
              <input
                id="caratMax"
                name="caratMax"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 2"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Leave both blank to apply the rate to every SKU in this lot that has a carat weight set.
            The amount is calculated as rate &times; total carats of matching SKUs.
          </p>
        </>
      )}

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
          placeholder="e.g. Sawing labor, batch details..."
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
