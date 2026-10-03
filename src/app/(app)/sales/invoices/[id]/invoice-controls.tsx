"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { updateInvoiceDetails, voidInvoice } from "../actions";
import { ShippingFields, type ShippingDefaults } from "../shipping-fields";

export function InvoiceDetailsForm({
  invoiceId,
  incoterms,
  defaults,
}: {
  invoiceId: string;
  incoterms: string[];
  defaults: ShippingDefaults & { dueDate: string };
}) {
  const [message, onSubmit, pending] = useFormAction(updateInvoiceDetails.bind(null, invoiceId), undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="block max-w-xs text-sm font-medium text-zinc-700">
        Payment due
        <input name="dueDate" type="date" defaultValue={defaults.dueDate} className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm" />
      </label>
      <ShippingFields incoterms={incoterms} defaults={defaults} />
      <p className="text-xs text-zinc-500">Stones and prices can&apos;t be changed on an invoice — an admin can void it and a new one can be made.</p>
      {message && <p className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-[var(--accent)] px-4 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save details"}
      </button>
    </form>
  );
}

export function VoidInvoiceButton({ invoiceId, hasPayments }: { invoiceId: string; hasPayments: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (hasPayments) {
    return <p className="text-sm text-zinc-500">To void this invoice, void its payments first.</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start rounded-md border border-red-200 px-4 text-sm text-red-700 hover:bg-red-50">
        Void invoice
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">The stones go back on memo (if they came from one) or into stock. This can&apos;t be undone.</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="min-h-11 rounded-md border border-red-200 bg-white px-3 text-sm" />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await voidInvoice(invoiceId, reason);
              if (r.error) setError(r.error);
              else setOpen(false);
            })
          }
          className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Voiding..." : "Void invoice"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-4 text-sm text-zinc-600">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
