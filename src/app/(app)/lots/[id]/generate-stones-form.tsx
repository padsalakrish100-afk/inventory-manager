"use client";

import { useActionState } from "react";
import { generateStones } from "../actions";

export function GenerateStonesForm({ lotId }: { lotId: string }) {
  const boundAction = generateStones.bind(null, lotId);
  const [result, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="count" className="block text-sm font-medium text-zinc-700">
          Number of stones
        </label>
        <input
          id="count"
          name="count"
          type="number"
          min={1}
          max={2000}
          required
          placeholder="e.g. 500"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Creates one SKU per stone, numbered {`{lot number}-0001`}, {`-0002`}, and so on, each with
          stock of 1. Run this again later to add more &mdash; numbering continues from where it left off.
        </p>
      </div>

      <div>
        <label htmlFor="namePrefix" className="block text-sm font-medium text-zinc-700">
          Name
        </label>
        <input
          id="namePrefix"
          name="namePrefix"
          type="text"
          required
          placeholder="e.g. Princess Cut 0.3ct"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">Same name on every stone &mdash; edit individual ones later once graded.</p>
      </div>

      <div>
        <label htmlFor="caratWeight" className="block text-sm font-medium text-zinc-700">
          Carat weight (per stone)
        </label>
        <input
          id="caratWeight"
          name="caratWeight"
          type="number"
          min={0}
          step="0.01"
          placeholder="Optional — leave blank if it varies per stone"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Set this if every stone in the batch weighs about the same &mdash; otherwise leave blank and
          edit each stone's weight individually once graded, for accurate cost allocation.
        </p>
      </div>

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.created !== undefined && (
        <p className="text-sm text-emerald-600">Created {result.created} stone{result.created === 1 ? "" : "s"}.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Generate stones"}
      </button>
    </form>
  );
}
