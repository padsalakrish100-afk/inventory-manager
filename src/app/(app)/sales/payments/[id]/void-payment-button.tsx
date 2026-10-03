"use client";

import { useState, useTransition } from "react";
import { voidPayment } from "../actions";

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start rounded-md border border-red-200 px-4 text-sm text-red-700 hover:bg-red-50">
        Void payment
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">The documents it settled become outstanding again. This can&apos;t be undone.</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="min-h-11 rounded-md border border-red-200 bg-white px-3 text-sm" />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await voidPayment(paymentId, reason);
              if (r.error) setError(r.error);
              else setOpen(false);
            })
          }
          className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Voiding..." : "Void payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-4 text-sm text-zinc-600">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
