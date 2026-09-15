"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLot } from "../actions";

export function DeleteLotButton({ lotId }: { lotId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this lot? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteLot(lotId);
              router.push("/lots");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete lot.");
            }
          });
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete lot"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
