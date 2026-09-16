"use client";

import { useActionState, useState } from "react";
import { updatePolishedStone } from "../actions";

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

type Defaults = {
  certified: boolean;
  certLab: string | null;
  certNumber: string | null;
  shape: string | null;
  caratWeight: number | null;
  color: string | null;
  clarity: string | null;
  cutGrade: string | null;
  polishGrade: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  measurements: string | null;
  notes: string | null;
};

export function EditPolishedStoneForm({ id, defaults }: { id: string; defaults: Defaults }) {
  const boundAction = updatePolishedStone.bind(null, id);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [certified, setCertified] = useState(defaults.certified);

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
            <Field label="Lab" name="certLab" defaultValue={defaults.certLab ?? ""} placeholder="e.g. GIA, IGI" />
            <Field label="Certificate number" name="certNumber" defaultValue={defaults.certNumber ?? ""} />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Grading
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Shape" name="shape" options={SHAPES} defaultValue={defaults.shape ?? ""} />
          <Field
            label="Carat weight"
            name="caratWeight"
            type="number"
            step="0.01"
            min={0}
            defaultValue={defaults.caratWeight ?? undefined}
          />
          <Select label="Color" name="color" options={COLORS} defaultValue={defaults.color ?? ""} />
          <Select label="Clarity" name="clarity" options={CLARITIES} defaultValue={defaults.clarity ?? ""} />
          <Select label="Cut" name="cutGrade" options={GRADES} defaultValue={defaults.cutGrade ?? ""} />
          <Select label="Polish" name="polishGrade" options={GRADES} defaultValue={defaults.polishGrade ?? ""} />
          <Select label="Symmetry" name="symmetry" options={GRADES} defaultValue={defaults.symmetry ?? ""} />
          <Select
            label="Fluorescence"
            name="fluorescence"
            options={FLUORESCENCE}
            defaultValue={defaults.fluorescence ?? ""}
          />
        </div>
        <Field
          label="Measurements (mm)"
          name="measurements"
          defaultValue={defaults.measurements ?? ""}
          placeholder="e.g. 5.10 - 5.13 x 3.15"
        />
      </fieldset>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          defaultValue={defaults.notes ?? ""}
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
        {pending ? "Saving..." : "Save changes"}
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

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
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
