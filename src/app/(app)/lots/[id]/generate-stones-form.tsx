"use client";

import { useActionState, useState } from "react";
import { generateStones } from "../actions";

export function GenerateStonesForm({ lotId }: { lotId: string }) {
  const boundAction = generateStones.bind(null, lotId);
  const [result, formAction, pending] = useActionState(boundAction, undefined);
  const [tracking, setTracking] = useState<"individual" | "loose">("individual");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <span className="block text-sm font-medium text-zinc-700">How to track it</span>
        <div className="mt-1 flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="tracking"
              value="individual"
              checked={tracking === "individual"}
              onChange={() => setTracking("individual")}
              className="mt-0.5"
            />
            <span>
              Individually &mdash; one SKU per stone (e.g. GIA-certified or single non-GIA stones you
              sell one at a time)
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="tracking"
              value="loose"
              checked={tracking === "loose"}
              onChange={() => setTracking("loose")}
              className="mt-0.5"
            />
            <span>As one loose parcel &mdash; a single SKU with all the pieces counted as its stock</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="count" className="block text-sm font-medium text-zinc-700">
          {tracking === "loose" ? "Number of pieces in the parcel" : "Number of stones"}
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
          {tracking === "loose"
            ? "Creates one SKU for the whole parcel, with this many pieces as its stock."
            : <>Creates one SKU per stone, numbered {"{lot number}-0001"}, {"-0002"}, and so on, each with
              stock of 1. Run this again later to add more &mdash; numbering continues from where it left off.</>}
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
        <p className="mt-1 text-xs text-zinc-500">
          {tracking === "loose"
            ? "e.g. \"Loose melee, mixed\" — edit later if needed."
            : "Same name on every stone — edit individual ones later once graded."}
        </p>
      </div>

      {tracking === "individual" && (
        <div>
          <label htmlFor="certification" className="block text-sm font-medium text-zinc-700">
            Certification
          </label>
          <select
            id="certification"
            name="certification"
            defaultValue="NONGIA"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="NONGIA">No GIA</option>
            <option value="GIA">GIA</option>
          </select>
        </div>
      )}

      {tracking === "loose" && (
        <p className="text-xs text-zinc-500">
          Loose parcels are created as No GIA &mdash; split individual stones out later if any get certified.
        </p>
      )}

      <div>
        <label htmlFor="caratWeight" className="block text-sm font-medium text-zinc-700">
          Carat weight (per {tracking === "loose" ? "piece" : "stone"})
        </label>
        <input
          id="caratWeight"
          name="caratWeight"
          type="number"
          min={0}
          step="0.01"
          placeholder="Optional — leave blank if it varies"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {tracking === "loose"
            ? "Average weight per piece, if known — used for cost allocation by carat."
            : "Set this if every stone in the batch weighs about the same — otherwise leave blank and edit each stone's weight individually once graded, for accurate cost allocation."}
        </p>
      </div>

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.created !== undefined && (
        <p className="text-sm text-emerald-600">
          {tracking === "loose"
            ? "Created the loose parcel."
            : `Created ${result.created} stone${result.created === 1 ? "" : "s"}.`}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating..." : tracking === "loose" ? "Add loose parcel" : "Generate stones"}
      </button>
    </form>
  );
}
