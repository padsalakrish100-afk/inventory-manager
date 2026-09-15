"use client";

import { useState, useTransition } from "react";
import { deleteProduct } from "./actions";

export function DeleteProductButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this product? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteProduct(productId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete product.");
            }
          });
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
