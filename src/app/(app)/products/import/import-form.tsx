"use client";

import { useActionState } from "react";
import { importProducts, type ImportResult } from "./actions";

export function ImportForm() {
  const [result, formAction, pending] = useActionState<ImportResult | undefined, FormData>(
    importProducts,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-zinc-700">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50"
        />
      </div>

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}

      {result && !result.error && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <p className="font-medium text-zinc-900">
            {result.created ?? 0} created, {result.updated ?? 0} updated
            {result.skipped && result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}.
          </p>
          {!!result.unmatchedLots && (
            <p className="mt-1 text-zinc-600">
              {result.unmatchedLots} row{result.unmatchedLots === 1 ? "" : "s"} referenced a lot number
              that doesn&apos;t exist yet — those products were imported without a lot link.
            </p>
          )}
          {result.skipped && result.skipped.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-red-600">
              {result.skipped.slice(0, 20).map((s, i) => (
                <li key={i}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
              {result.skipped.length > 20 && <li>...and {result.skipped.length - 20} more.</li>}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Importing..." : "Upload and import"}
      </button>
    </form>
  );
}
