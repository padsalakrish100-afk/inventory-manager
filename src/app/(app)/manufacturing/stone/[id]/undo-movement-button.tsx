"use client";

import { useState, useTransition } from "react";
import { undoMovement } from "../../actions";

export function UndoMovementButton({ movementId, productId }: { movementId: string; productId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Undo this entry? This removes it completely, not just marks it returned.")) return;
          setError(null);
          startTransition(async () => {
            try {
              await undoMovement(movementId, productId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to undo.");
            }
          });
        }}
        className="text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Undoing..." : "Undo"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
