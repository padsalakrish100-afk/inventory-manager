"use client";

import { useState, useTransition } from "react";
import { reviewExcessLoss } from "../actions";

export function ReviewButton({ movementId }: { movementId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const note = prompt("Review note (optional) — e.g. action taken with the karigar");
          if (note === null) return;
          setError(null);
          startTransition(async () => {
            const result = await reviewExcessLoss(movementId, note);
            if (result.error) setError(result.error);
          });
        }}
        className="min-h-10 whitespace-nowrap rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Mark reviewed"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
