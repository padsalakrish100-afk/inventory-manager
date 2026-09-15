"use client";

import { useActionState } from "react";
import { STAGE_OPTIONS } from "@/lib/stages";

type LotFormAction = (
  prevState: string | undefined,
  formData: FormData,
) => Promise<string | undefined>;

export function LotForm({
  action,
  defaultValues,
  submitLabel,
  lotNumberEditable = true,
}: {
  action: LotFormAction;
  defaultValues?: {
    lotNumber: string;
    roughWeight: number | null;
    polishedWeight: number | null;
    description: string | null;
    status: string;
  };
  submitLabel: string;
  lotNumberEditable?: boolean;
}) {
  const [error, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {lotNumberEditable ? (
        <div>
          <label htmlFor="lotNumber" className="block text-sm font-medium text-zinc-700">
            Lot number
          </label>
          <input
            id="lotNumber"
            name="lotNumber"
            type="text"
            required
            defaultValue={defaultValues?.lotNumber}
            placeholder="e.g. LOT-2026-001"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      ) : (
        <div>
          <span className="block text-sm font-medium text-zinc-700">Lot number</span>
          <p className="mt-1 font-mono text-sm text-zinc-900">{defaultValues?.lotNumber}</p>
        </div>
      )}

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
          defaultValue={defaultValues?.roughWeight ?? undefined}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="polishedWeight" className="block text-sm font-medium text-zinc-700">
          Polished weight (carat)
        </label>
        <input
          id="polishedWeight"
          name="polishedWeight"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.polishedWeight ?? undefined}
          placeholder="Total carats across all polished stones"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-zinc-700">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? "ROUGH"}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Source, parcel details, anything worth noting"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
