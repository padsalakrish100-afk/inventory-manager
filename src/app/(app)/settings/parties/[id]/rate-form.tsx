"use client";

import { useActionState } from "react";
import { addProcessRate } from "../actions";
import { PROCESS_OPTIONS } from "@/lib/process";

export function RateForm({ partyId }: { partyId: string }) {
  const boundAction = addProcessRate.bind(null, partyId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <label htmlFor="process" className="block text-xs font-medium text-zinc-500">
          Process
        </label>
        <select
          id="process"
          name="process"
          defaultValue={PROCESS_OPTIONS[0].value}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          {PROCESS_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ratePerCarat" className="block text-xs font-medium text-zinc-500">
          Rate per carat (₹)
        </label>
        <input
          id="ratePerCarat"
          name="ratePerCarat"
          type="number"
          min={0}
          step="0.01"
          required
          placeholder="e.g. 50"
          className="mt-1 w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="effectiveFrom" className="block text-xs font-medium text-zinc-500">
          Effective from
        </label>
        <input
          id="effectiveFrom"
          name="effectiveFrom"
          type="date"
          defaultValue={today}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add rate"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
