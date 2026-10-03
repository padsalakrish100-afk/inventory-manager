"use client";

import { useFormAction } from "@/lib/use-form-action";
import { updateCompanySettings } from "../actions";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none sm:text-sm";
const LABEL = "block text-sm font-medium text-zinc-700";

type Defaults = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxInfo: string;
  bankDetails: string;
  memoTerms: string;
  invoiceTerms: string;
  invoiceWarranty: string;
  memoDueDays: number;
  invoiceDueDays: number;
};

export function CompanyForm({ defaults, placeholders }: { defaults: Defaults; placeholders: { memoTerms: string; invoiceWarranty: string } }) {
  const [message, onSubmit, pending] = useFormAction(updateCompanySettings, undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="companyName" className={LABEL}>
          Company name
        </label>
        <input id="companyName" name="companyName" required defaultValue={defaults.companyName} className={INPUT} />
      </div>
      <div>
        <label htmlFor="companyAddress" className={LABEL}>
          Address
        </label>
        <textarea id="companyAddress" name="companyAddress" rows={3} defaultValue={defaults.companyAddress} className={INPUT} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="companyPhone" className={LABEL}>
            Phone
          </label>
          <input id="companyPhone" name="companyPhone" defaultValue={defaults.companyPhone} className={INPUT} />
        </div>
        <div>
          <label htmlFor="companyEmail" className={LABEL}>
            Email
          </label>
          <input id="companyEmail" name="companyEmail" type="email" defaultValue={defaults.companyEmail} className={INPUT} />
        </div>
      </div>
      <div>
        <label htmlFor="companyTaxInfo" className={LABEL}>
          Tax / registration line
        </label>
        <input id="companyTaxInfo" name="companyTaxInfo" defaultValue={defaults.companyTaxInfo} placeholder="e.g. EIN …, GSTIN …, IEC …" className={INPUT} />
      </div>
      <div>
        <label htmlFor="bankDetails" className={LABEL}>
          Bank details (printed on invoices)
        </label>
        <textarea id="bankDetails" name="bankDetails" rows={4} defaultValue={defaults.bankDetails} placeholder="Bank, account name, account no., SWIFT/ABA/IFSC" className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="memoDueDays" className={LABEL}>
            Memo due after (days)
          </label>
          <input id="memoDueDays" name="memoDueDays" type="number" min={1} max={365} defaultValue={defaults.memoDueDays} className={INPUT} />
        </div>
        <div>
          <label htmlFor="invoiceDueDays" className={LABEL}>
            Invoice due after (days)
          </label>
          <input id="invoiceDueDays" name="invoiceDueDays" type="number" min={0} max={365} defaultValue={defaults.invoiceDueDays} className={INPUT} />
        </div>
      </div>
      <div>
        <label htmlFor="memoTerms" className={LABEL}>
          Memo terms
        </label>
        <textarea id="memoTerms" name="memoTerms" rows={5} defaultValue={defaults.memoTerms} placeholder={placeholders.memoTerms} className={INPUT} />
        <p className="mt-1 text-xs text-zinc-500">Leave blank to use the standard wording shown.</p>
      </div>
      <div>
        <label htmlFor="invoiceTerms" className={LABEL}>
          Invoice terms
        </label>
        <textarea id="invoiceTerms" name="invoiceTerms" rows={3} defaultValue={defaults.invoiceTerms} placeholder="Optional — e.g. payment terms, jurisdiction" className={INPUT} />
      </div>
      <div>
        <label htmlFor="invoiceWarranty" className={LABEL}>
          Invoice warranty statement
        </label>
        <textarea id="invoiceWarranty" name="invoiceWarranty" rows={4} defaultValue={defaults.invoiceWarranty} placeholder={placeholders.invoiceWarranty} className={INPUT} />
        <p className="mt-1 text-xs text-zinc-500">The Kimberley Process System of Warranties statement. Leave blank to use the standard wording shown.</p>
      </div>
      {message && <p className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-[var(--accent)] px-4 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
