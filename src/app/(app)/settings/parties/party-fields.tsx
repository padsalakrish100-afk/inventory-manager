import { PARTY_ROLE_OPTIONS } from "@/lib/party-category";

export type PartyFieldDefaults = {
  roles: string[];
  companyName: string | null;
  contactPerson: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  taxOther: string | null;
  creditLimit: string | null;
  creditCurrency: string | null;
  notes: string | null;
};

export const EMPTY_PARTY_DEFAULTS: PartyFieldDefaults = {
  roles: [],
  companyName: null,
  contactPerson: null,
  country: null,
  phone: null,
  email: null,
  address: null,
  gstin: null,
  pan: null,
  taxOther: null,
  creditLimit: null,
  creditCurrency: "USD",
  notes: null,
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

function TextField({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

// The shared field set for adding and editing a party.
export function PartyFields({ defaults }: { defaults: PartyFieldDefaults }) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700">Roles</legend>
        <p className="text-xs text-zinc-500">A party can have more than one.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PARTY_ROLE_OPTIONS.map((r) => (
            <label
              key={r.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-50"
            >
              <input
                type="checkbox"
                name="roles[]"
                value={r.value}
                defaultChecked={defaults.roles.includes(r.value)}
                className="h-4 w-4"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="companyName" label="Company" defaultValue={defaults.companyName} />
        <TextField name="contactPerson" label="Contact person" defaultValue={defaults.contactPerson} />
        <TextField name="phone" label="Phone" type="tel" defaultValue={defaults.phone} />
        <TextField name="email" label="Email" type="email" defaultValue={defaults.email} />
        <TextField name="country" label="Country" defaultValue={defaults.country} placeholder="e.g. India, USA" />
        <TextField name="address" label="Address" defaultValue={defaults.address} />
        <TextField name="gstin" label="GSTIN" defaultValue={defaults.gstin} />
        <TextField name="pan" label="PAN" defaultValue={defaults.pan} />
        <TextField name="taxOther" label="Other tax ID (EIN, IEC, VAT…)" defaultValue={defaults.taxOther} />
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <TextField name="creditLimit" label="Credit limit" defaultValue={defaults.creditLimit} />
          <div>
            <label htmlFor="creditCurrency" className="block text-sm font-medium text-zinc-700">
              Currency
            </label>
            <select
              id="creditCurrency"
              name="creditCurrency"
              defaultValue={defaults.creditCurrency ?? "USD"}
              className={inputClass}
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </div>
      </div>
      <TextField name="notes" label="Notes" defaultValue={defaults.notes} />
    </div>
  );
}
