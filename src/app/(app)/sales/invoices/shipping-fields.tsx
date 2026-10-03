const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none sm:text-sm";
const LABEL = "block text-sm font-medium text-zinc-700";

export type ShippingDefaults = Partial<
  Record<
    "shipToName" | "shipToAddress" | "shipToCountry" | "incoterm" | "hsCode" | "portOfLoading" | "portOfDischarge" | "awbNo" | "carrier" | "kpCertNo" | "notes",
    string
  >
>;

// Ship-to and export fields, shared by the new-invoice and edit-details forms.
export function ShippingFields({ incoterms, defaults }: { incoterms: string[]; defaults: ShippingDefaults }) {
  const v = (k: keyof ShippingDefaults) => defaults[k] ?? "";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="shipToName" className={LABEL}>
          Ship to
        </label>
        <input id="shipToName" name="shipToName" defaultValue={v("shipToName")} className={INPUT} />
      </div>
      <div>
        <label htmlFor="shipToCountry" className={LABEL}>
          Country
        </label>
        <input id="shipToCountry" name="shipToCountry" defaultValue={v("shipToCountry")} className={INPUT} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="shipToAddress" className={LABEL}>
          Address
        </label>
        <textarea id="shipToAddress" name="shipToAddress" rows={2} defaultValue={v("shipToAddress")} className={INPUT} />
      </div>
      <div>
        <label htmlFor="incoterm" className={LABEL}>
          Incoterm
        </label>
        <select id="incoterm" name="incoterm" defaultValue={v("incoterm")} className={INPUT}>
          <option value="">—</option>
          {incoterms.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="hsCode" className={LABEL}>
          HS code
        </label>
        <input id="hsCode" name="hsCode" defaultValue={v("hsCode")} className={INPUT} />
      </div>
      <div>
        <label htmlFor="portOfLoading" className={LABEL}>
          Port of loading
        </label>
        <input id="portOfLoading" name="portOfLoading" defaultValue={v("portOfLoading")} placeholder="e.g. Mumbai (BDB)" className={INPUT} />
      </div>
      <div>
        <label htmlFor="portOfDischarge" className={LABEL}>
          Port of discharge
        </label>
        <input id="portOfDischarge" name="portOfDischarge" defaultValue={v("portOfDischarge")} placeholder="e.g. New York (JFK)" className={INPUT} />
      </div>
      <div>
        <label htmlFor="carrier" className={LABEL}>
          Carrier
        </label>
        <input id="carrier" name="carrier" defaultValue={v("carrier")} placeholder="e.g. Malca-Amit, Brink's" className={INPUT} />
      </div>
      <div>
        <label htmlFor="awbNo" className={LABEL}>
          AWB number
        </label>
        <input id="awbNo" name="awbNo" defaultValue={v("awbNo")} className={INPUT} />
      </div>
      <div>
        <label htmlFor="kpCertNo" className={LABEL}>
          KP certificate no.
        </label>
        <input id="kpCertNo" name="kpCertNo" defaultValue={v("kpCertNo")} placeholder="If shipped with a KP certificate" className={INPUT} />
      </div>
      <div>
        <label htmlFor="notes" className={LABEL}>
          Notes on invoice
        </label>
        <input id="notes" name="notes" defaultValue={v("notes")} placeholder="Optional" className={INPUT} />
      </div>
    </div>
  );
}
