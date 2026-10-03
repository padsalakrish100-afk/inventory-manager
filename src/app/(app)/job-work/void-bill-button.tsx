"use client";

import { useTransition } from "react";
import { voidJobWorkBill } from "./actions";

export function VoidBillButton({ billId }: { billId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancel this bill? Its jobs become unbilled again.")) return;
        startTransition(async () => {
          const r = await voidJobWorkBill(billId);
          if (r.error) alert(r.error);
        });
      }}
      className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
    >
      Cancel
    </button>
  );
}
