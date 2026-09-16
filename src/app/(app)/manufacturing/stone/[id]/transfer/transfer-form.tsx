"use client";

import { useActionState, useState } from "react";
import { transferToPolish } from "../../../actions";

const SHAPES = [
  "Round",
  "Princess",
  "Cushion",
  "Oval",
  "Emerald",
  "Pear",
  "Marquise",
  "Radiant",
  "Asscher",
  "Heart",
];
const COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];
const GRADES = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
const FLUORESCENCE = ["None", "Faint", "Medium", "Strong", "Very Strong"];

export function TransferForm({ productId, defaultCaratWeight }: { productId: string; defaultCaratWeight: number | null }) {
  const boundAction = transferToPolish.bind(null, productId);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [certified, setCertified] = useState(false);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Certification
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="certified"
            value="true"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
          />
          This stone is certified
        </label>
        {certified && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lab" name="certLab" placeholder="e.g. GIA, IGI" />
            <Field label="Certificate number" name="certNumber" />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Grading
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Shape" name="shape" options={SHAPES} />
          <Field
            label="Carat weight"
            name="caratWeight"
            type="number"
            step="0.01"
            min={0}
            defaultValue={defaultCaratWeight ?? undefined}
          />
          <Select label="Color" name="color" options={COLORS} />
          <Select label="Clarity" name="clarity" options={CLARITIES} />
          <Select label="Cut" name="cutGrade" options={GRADES} />
          <Select label="Polish" name="polishGrade" options={GRADES} />
          <Select label="Symmetry" name="symmetry" options={GRADES} />
          <Select label="Fluorescence" name="fluorescence" options={FLUORESCENCE} />
        </div>
        <Field label="Measurements (mm)" name="measurements" placeholder="e.g. 5.10 - 5.13 x 3.15" />
      </fieldset>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          placeholder="Optional"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Transferring..." : "Transfer to Polish"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  step?: string;
  min?: number;
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
        placeholder={placeholder}
        step={step}
        min={min}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
