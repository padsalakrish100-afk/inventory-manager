"use client";

import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";
import { moveStoneLocation } from "../actions";

export function MoveLocationForm({
  stoneId,
  current,
  options,
}: {
  stoneId: string;
  current: string;
  options: { value: string; label: string }[];
}) {
  const [error, onSubmit, pending] = useFormAction(moveStoneLocation, undefined);
  const [open, setOpen] = useState(false);
  const choices = options.filter((o) => o.value !== current);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-50"
      >
        Move
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:w-auto">
      <input type="hidden" name="stoneId" value={stoneId} />
      <p className="text-sm font-medium text-zinc-700">Move to</p>
      <div className="flex flex-wrap gap-2">
        {choices.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-zinc-600 has-[:checked]:bg-zinc-50"
          >
            <input type="radio" name="location" value={o.value} required className="h-4 w-4" />
            {o.label}
          </label>
        ))}
      </div>
      <input
        name="note"
        placeholder="Note (optional)"
        className="min-h-11 rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Moving..." : "Move stone"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
