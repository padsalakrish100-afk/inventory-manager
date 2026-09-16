"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStone } from "../../actions";

export function DeleteStoneButton({ productId, lotId }: { productId: string; lotId: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this stone entirely? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteStone(productId);
              router.push(lotId ? `/lotting/${lotId}` : "/manufacturing");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete stone.");
            }
          });
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete stone"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
