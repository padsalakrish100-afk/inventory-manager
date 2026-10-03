"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { createRoughPurchase } from "../actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function PurchaseForm({ vendorNames, defaultFx }: { vendorNames: string[]; defaultFx: string | null }) {
  const [error, onSubmit, pending] = useFormAction(createRoughPurchase, undefined);
  const [carats, setCarats] = useState("");
  const [ppc, setPpc] = useState("");
  const [total, setTotal] = useState("");

  const preview =
    total === "" && ppc !== "" && Number(carats) > 0 ? (Number(ppc) * Number(carats)).toFixed(2) : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Supplier / tender house
          <input name="party" list="rough-vendors" required className={inputClass} />
          <datalist id="rough-vendors">
            {vendorNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Tender / source
          <input name="source" placeholder="e.g. Antwerp tender Sept-26" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Purchase date
          <input name="date" type="date" defaultValue={todayIST()} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Payment due
          <input name="dueDate" type="date" className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Total carats
          <input
            name="totalCarats"
            inputMode="decimal"
            required
            value={carats}
            onChange={(e) => setCarats(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Pieces
          <input name="pieces" inputMode="numeric" required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Price per carat
          <input name="pricePerCarat" inputMode="decimal" value={ppc} onChange={(e) => setPpc(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Total amount
          <input
            name="totalAmount"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder={preview ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Currency
          <select name="currency" defaultValue="USD" className={inputClass}>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          ₹ per $1 on the date
          <input name="fxRate" inputMode="decimal" defaultValue={defaultFx ?? ""} placeholder="e.g. 88.25" className={inputClass} />
        </label>
      </div>
      {preview && <p className="-mt-2 text-xs text-zinc-500">Total will be {preview}.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Invoice number
          <input name="invoiceNo" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Invoice file (PDF / photo)
          <input name="invoiceFiles" type="file" accept="application/pdf,image/*" multiple className="mt-1 block w-full text-sm" />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Kimberley Process certificate no.
          <input name="kpCertNo" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          KP certificate file
          <input name="kpFiles" type="file" accept="application/pdf,image/*" multiple className="mt-1 block w-full text-sm" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">Files up to 3 MB each. The KP number is required before any packet goes into production.</p>

      <label className="text-sm font-medium text-zinc-700">
        Notes
        <input name="notes" className={inputClass} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save purchase"}
      </button>
    </form>
  );
}
