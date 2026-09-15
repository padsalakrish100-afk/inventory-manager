"use client";

import { useActionState } from "react";
import { bulkUpdateStage } from "../actions";
import { STAGE_OPTIONS } from "@/lib/stages";

export function BulkStageForm({ lotId, skuCount }: { lotId: string; skuCount: number }) {
  const boundAction = bulkUpdateStage.bind(null, lotId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);

  if (skuCount === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="bulkStage" className="block text-xs font-medium text-zinc-500">
          Move all {skuCount} SKU{skuCount === 1 ? "" : "s"} in this lot to
        </label>
        <select
          id="bulkStage"
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Updating..." : "Apply to all"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
