"use client";

import { useActionState } from "react";
import { STAGE_OPTIONS } from "@/lib/stages";

type ProductFormAction = (
  prevState: string | undefined,
  formData: FormData,
) => Promise<string | undefined>;

type LotOption = { id: string; lotNumber: string };

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
  lots = [],
  locationSuggestions = ["Surat", "Mumbai"],
}: {
  action: ProductFormAction;
  defaultValues?: {
    sku: string;
    name: string;
    unit: string;
    stock: number;
    reorderLevel: number;
    location: string | null;
    giaCertified: boolean;
    caratWeight: number | null;
    color: string | null;
    clarity: string | null;
    cutGrade: string | null;
    costPrice: number;
    sellingPrice: number;
    lotId: string | null;
    stage: string;
  };
  submitLabel: string;
  lots?: LotOption[];
  locationSuggestions?: string[];
}) {
  const [error, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <FormSection title="Basic info">
        <Field label="SKU" name="sku" defaultValue={defaultValues?.sku} required />
        <Field label="Name" name="name" defaultValue={defaultValues?.name} required />
        <Field label="Unit" name="unit" defaultValue={defaultValues?.unit ?? "pcs"} />
        <Field
          label="Current stock"
          name="stock"
          type="number"
          min={0}
          defaultValue={defaultValues?.stock ?? 0}
          required
        />
        <Field
          label="Reorder level"
          name="reorderLevel"
          type="number"
          min={0}
          defaultValue={defaultValues?.reorderLevel ?? 0}
          required
        />
      </FormSection>

      <FormSection title="Sourcing">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-zinc-700">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            list="location-suggestions"
            defaultValue={defaultValues?.location ?? ""}
            placeholder="Surat, Mumbai, ..."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <datalist id="location-suggestions">
            {locationSuggestions.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="giaCertified" className="block text-sm font-medium text-zinc-700">
            Certification
          </label>
          <select
            id="giaCertified"
            name="giaCertified"
            defaultValue={defaultValues?.giaCertified ? "true" : "false"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="false">No GIA</option>
            <option value="true">GIA</option>
          </select>
        </div>

        <div>
          <label htmlFor="lotId" className="block text-sm font-medium text-zinc-700">
            Lot
          </label>
          <select
            id="lotId"
            name="lotId"
            defaultValue={defaultValues?.lotId ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Not from a tracked lot</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber}
              </option>
            ))}
          </select>
        </div>
      </FormSection>

      <FormSection title="Manufacturing" subtitle="Where this SKU is in the process right now.">
        <div>
          <label htmlFor="stage" className="block text-sm font-medium text-zinc-700">
            Stage
          </label>
          <select
            id="stage"
            name="stage"
            defaultValue={defaultValues?.stage ?? "ROUGH"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </FormSection>

      <FormSection title="Quality" subtitle="Optional — leave blank if not applicable.">
        <Field
          label="Carat weight"
          name="caratWeight"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.caratWeight ?? undefined}
        />
        <Field label="Color" name="color" defaultValue={defaultValues?.color ?? ""} placeholder="e.g. D, E, F..." />
        <Field
          label="Clarity"
          name="clarity"
          defaultValue={defaultValues?.clarity ?? ""}
          placeholder="e.g. VVS1, SI2..."
        />
        <Field
          label="Cut grade"
          name="cutGrade"
          defaultValue={defaultValues?.cutGrade ?? ""}
          placeholder="e.g. Excellent, Good..."
        />
      </FormSection>

      <FormSection title="Pricing" subtitle="Per unit, in ₹.">
        <Field
          label="Cost price"
          name="costPrice"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.costPrice ?? 0}
        />
        <Field
          label="Selling price"
          name="sellingPrice"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.sellingPrice ?? 0}
        />
      </FormSection>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 border-0 p-0">
      <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
        {subtitle && <span className="ml-2 normal-case tracking-normal text-zinc-400">{subtitle}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  min,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
  step?: string;
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
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}
