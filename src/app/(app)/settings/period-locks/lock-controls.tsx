"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { lockPeriod, unlockPeriod } from "../actions";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm";

export function LockForm({ defaultMonth, defaultDay }: { defaultMonth: string; defaultDay: string }) {
  const [error, onSubmit, pending] = useFormAction(lockPeriod, undefined);
  const [type, setType] = useState<"MONTH" | "DAY">("MONTH");
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-4">
      <label className="text-sm font-medium text-zinc-700">
        Close a
        <select name="periodType" value={type} onChange={(e) => setType(e.target.value as "MONTH" | "DAY")} className={INPUT}>
          <option value="MONTH">Month</option>
          <option value="DAY">Day</option>
        </select>
      </label>
      <label className="text-sm font-medium text-zinc-700">
        {type === "MONTH" ? "Month" : "Day"}
        {type === "MONTH" ? (
          <input key="m" name="period" type="month" required defaultValue={defaultMonth} className={INPUT} />
        ) : (
          <input key="d" name="period" type="date" required defaultValue={defaultDay} className={INPUT} />
        )}
      </label>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Note
        <input name="note" placeholder="Optional — e.g. books checked by CA" className={INPUT} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-md bg-[var(--accent)] px-5 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Locking..." : "Lock period"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export function UnlockButton({ lockId, label }: { lockId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">
        Unlock
      </button>
    );
  }
  return (
    <div className="flex min-w-56 flex-col items-stretch gap-2 text-left">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Why unlock ${label}?`}
        className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await unlockPeriod(lockId, reason);
              if (r.error) setError(r.error);
              else setOpen(false);
            })
          }
          className="min-h-10 rounded-md bg-amber-600 px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Unlocking..." : "Unlock"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 px-2 text-sm text-zinc-500">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
