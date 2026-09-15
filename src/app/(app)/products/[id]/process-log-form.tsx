"use client";

import { useActionState } from "react";
import { addProcessLog } from "../actions";
import { STAGE_OPTIONS } from "@/lib/stages";

export function ProcessLogForm({ productId, partyNames }: { productId: string; partyNames: string[] }) {
  const boundAction = addProcessLog.bind(null, productId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <label htmlFor="processStage" className="block text-xs font-medium text-zinc-500">
          Stage
        </label>
        <select
          id="processStage"
          name="stage"
          defaultValue="ROUGH"
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="processParty" className="block text-xs font-medium text-zinc-500">
          Party
        </label>
        <input
          id="processParty"
          name="party"
          type="text"
          list="process-party-suggestions"
          placeholder="e.g. Galaxy Scanning Co."
          className="mt-1 w-44 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <datalist id="process-party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="processDate" className="block text-xs font-medium text-zinc-500">
          Date
        </label>
        <input
          id="processDate"
          name="date"
          type="date"
          defaultValue={today}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex-1">
        <label htmlFor="processNotes" className="block text-xs font-medium text-zinc-500">
          Notes
        </label>
        <input
          id="processNotes"
          name="notes"
          type="text"
          placeholder="Optional"
          className="mt-1 w-full min-w-[10rem] rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add step"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
