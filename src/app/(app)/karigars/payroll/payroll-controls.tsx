"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { addAdjustment, payKarigar, reversePayroll, voidAdjustment } from "../actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function PayButton({
  partyId,
  name,
  from,
  to,
  net,
  netLabel,
}: {
  partyId: string;
  name: string;
  from: string;
  to: string;
  net: string;
  netLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const paymentMode = prompt(`Pay ${name} ${netLabel} for ${from} to ${to}.\n\nPayment mode (cash, UPI, bank…):`, "Cash");
          if (paymentMode === null) return;
          const paymentRef = prompt("Reference (UPI/cheque no., optional):", "") ?? "";
          setError(null);
          startTransition(async () => {
            const r = await payKarigar({ partyId, from, to, paymentMode, paymentRef, expectedNet: net });
            if (r.error) setError(r.error);
          });
        }}
        className="min-h-10 whitespace-nowrap rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Paying..." : "Mark paid"}
      </button>
      {error && <span className="max-w-[16rem] text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function ReverseButton({ runId }: { runId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const reason = prompt("Reverse this payroll? Its labour and adjustments become unpaid again.\n\nReason:");
          if (reason === null) return;
          startTransition(async () => {
            const r = await reversePayroll(runId, reason);
            if (r.error) setError(r.error);
          });
        }}
        className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
      >
        Reverse
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function VoidAdjustmentButton({ adjustmentId }: { adjustmentId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Remove this entry?")) return;
        startTransition(async () => {
          const r = await voidAdjustment(adjustmentId);
          if (r.error) alert(r.error);
        });
      }}
      className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
    >
      Remove
    </button>
  );
}

export function AdjustmentForm({ karigarNames }: { karigarNames: string[] }) {
  const [error, onSubmit, pending] = useFormAction(addAdjustment, undefined, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-6 sm:items-end">
      <label className="col-span-2 text-xs font-medium text-zinc-500">
        Karigar
        <input name="party" list="payroll-karigars" required className={inputClass} />
        <datalist id="payroll-karigars">
          {karigarNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Type
        <select name="type" defaultValue="ADVANCE" className={inputClass}>
          <option value="ADVANCE">Advance given</option>
          <option value="DEDUCTION">Deduction</option>
          <option value="BONUS">Bonus</option>
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Amount (₹)
        <input name="amount" inputMode="decimal" required className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Date
        <input name="date" type="date" defaultValue={todayIST()} className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Note
        <input name="note" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 min-h-11 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:col-span-6 sm:w-fit"
      >
        {pending ? "Adding..." : "Add advance / deduction / bonus"}
      </button>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-6">{error}</p>}
    </form>
  );
}
