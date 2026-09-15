"use client";

import { useActionState, useRef, useState } from "react";
import { addExpense } from "../actions";
import { STAGE_LABELS } from "@/lib/stages";

const categories = [
  { value: "ROUGH_PURCHASE", label: "Rough purchase" },
  { value: "SAWING", label: "Sawing" },
  { value: "CUTTING", label: "Cutting" },
  { value: "POLISHING", label: "Polishing" },
  { value: "CERTIFICATION", label: "Certification (GIA, etc.)" },
  { value: "OTHER", label: "Other" },
];

export type SavedRate = {
  id: string;
  stage: string;
  partyName: string;
  ratePerCarat: number;
  caratMin: number | null;
  caratMax: number | null;
};

export function ExpenseForm({
  lotId,
  partyNames,
  savedRates = [],
}: {
  lotId: string;
  partyNames: string[];
  savedRates?: SavedRate[];
}) {
  const boundAction = addExpense.bind(null, lotId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [mode, setMode] = useState<"flat" | "rate">("flat");

  const partyRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const caratMinRef = useRef<HTMLInputElement>(null);
  const caratMaxRef = useRef<HTMLInputElement>(null);

  function applySavedRate(rateId: string) {
    const rate = savedRates.find((r) => r.id === rateId);
    if (!rate) return;
    if (partyRef.current) partyRef.current.value = rate.partyName;
    if (rateRef.current) rateRef.current.value = String(rate.ratePerCarat);
    if (caratMinRef.current) caratMinRef.current.value = rate.caratMin !== null ? String(rate.caratMin) : "";
    if (caratMaxRef.current) caratMaxRef.current.value = rate.caratMax !== null ? String(rate.caratMax) : "";
  }

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
          ref={partyRef}
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

      {mode === "rate" && savedRates.length > 0 && (
        <div>
          <label htmlFor="savedRate" className="block text-sm font-medium text-zinc-700">
            Use a saved rate
          </label>
          <select
            id="savedRate"
            defaultValue=""
            onChange={(e) => applySavedRate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Choose one to fill in party, rate and carat range below...</option>
            {savedRates.map((r) => (
              <option key={r.id} value={r.id}>
                {STAGE_LABELS[r.stage] ?? r.stage} — {r.partyName} — ₹{r.ratePerCarat.toFixed(2)}/ct
                {r.caratMin !== null || r.caratMax !== null
                  ? ` (${r.caratMin ?? "0"}–${r.caratMax ?? "∞"}ct)`
                  : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Set these up in Settings so they don't need retyping each time.
          </p>
        </div>
      )}

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
              ref={rateRef}
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
                ref={caratMinRef}
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
                ref={caratMaxRef}
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
