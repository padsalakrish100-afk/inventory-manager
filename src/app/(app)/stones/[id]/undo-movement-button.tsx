"use client";

import { useState, useTransition } from "react";
import { voidMovement } from "../../manufacturing/actions";

// Undo = void: the entry stays in history (struck through, with the reason)
// and the stone goes back to where it was before that issue.
export function UndoMovementButton({ movementId }: { movementId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const reason = prompt("Why undo this entry? (kept in the history)");
          if (reason === null) return;
          setError(null);
          startTransition(async () => {
            const result = await voidMovement(movementId, reason);
            if (result.error) setError(result.error);
          });
        }}
        className="min-h-10 px-2 text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Undoing..." : "Undo"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
