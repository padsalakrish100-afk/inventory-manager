"use client";

import { useState, useTransition } from "react";
import { allocateExpenses } from "../actions";

export function AllocateButton({ lotId }: { lotId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              "This overwrites the cost price on every SKU linked to this lot with its allocated share of total expenses. Continue?",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              await allocateExpenses(lotId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to allocate expenses.");
            }
          });
        }}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Applying..." : "Apply allocation to cost prices"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
