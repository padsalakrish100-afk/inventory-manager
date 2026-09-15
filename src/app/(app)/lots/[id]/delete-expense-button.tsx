"use client";

import { useState, useTransition } from "react";
import { deleteExpense } from "../actions";

export function DeleteExpenseButton({ expenseId, lotId }: { expenseId: string; lotId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Remove this expense?")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteExpense(expenseId, lotId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to remove expense.");
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
