"use client";

import { useState, useTransition } from "react";
import { setPartyActive } from "./actions";

export function ActiveToggleButton({ partyId, active }: { partyId: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setPartyActive(partyId, !active);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to update.");
            }
          });
        }}
        className={`rounded-md border px-3 py-1 text-xs font-medium ${
          active
            ? "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        } disabled:opacity-50`}
      >
        {isPending ? "..." : active ? "Deactivate" : "Reactivate"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
