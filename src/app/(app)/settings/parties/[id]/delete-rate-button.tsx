"use client";

import { useState, useTransition } from "react";
import { deleteProcessRate } from "../actions";

export function DeleteRateButton({ rateId, partyId }: { rateId: string; partyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Remove this rate entry?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteProcessRate(rateId, partyId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to remove.");
            }
          });
        }}
        className="text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Remove"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
