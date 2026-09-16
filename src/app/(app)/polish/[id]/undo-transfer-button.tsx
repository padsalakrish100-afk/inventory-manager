"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoTransfer } from "../actions";

export function UndoTransferButton({ polishedStoneId }: { polishedStoneId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Undo this transfer? The Stock ID will be removed and the stone sent back to Manufacturing.")) return;
          setError(null);
          startTransition(async () => {
            try {
              const sourceProductId = await undoTransfer(polishedStoneId);
              router.push(`/manufacturing/stone/${sourceProductId}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to undo transfer.");
            }
          });
        }}
        className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Undoing..." : "Undo transfer"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
