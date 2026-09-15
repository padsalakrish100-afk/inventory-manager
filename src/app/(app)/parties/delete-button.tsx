"use client";

import { useState, useTransition } from "react";
import { deleteParty } from "./actions";

export function DeletePartyButton({ partyId }: { partyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Remove this contact?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteParty(partyId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete contact.");
            }
          });
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
