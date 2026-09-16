"use client";

import { useActionState } from "react";
import { createLot } from "./actions";

export function LotForm({ partyNames }: { partyNames: string[] }) {
  const [error, formAction, pending] = useActionState(createLot, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      <div>
        <label htmlFor="sourceParty" className="block text-sm font-medium text-zinc-700">
          Source (tender or party)
        </label>
        <input
          id="sourceParty"
          name="sourceParty"
          type="text"
          list="source-party-suggestions"
          required
          placeholder="e.g. Surat Tender Feb-2026, or a party name"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <datalist id="source-party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="roughWeight" className="block text-sm font-medium text-zinc-700">
          Rough weight (carat)
        </label>
        <input
          id="roughWeight"
          name="roughWeight"
          type="number"
          min={0}
          step="0.01"
          placeholder="e.g. 500"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="stoneCount" className="block text-sm font-medium text-zinc-700">
          Number of stones
        </label>
        <input
          id="stoneCount"
          name="stoneCount"
          type="number"
          min={1}
          max={5000}
          required
          placeholder="e.g. 500"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          The lot number and every stone's number are generated automatically — nothing else to fill in.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create lot"}
      </button>
    </form>
  );
}
