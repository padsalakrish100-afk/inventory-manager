"use client";

import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";
import { updatePolishedStone } from "../actions";
import { SALE_TYPE_OPTIONS } from "@/lib/polish-status";
import { CUT_STYLES, SHAPES as CUT_SHAPES } from "@/lib/cuts";
import { CERT_LABS } from "@/lib/stone/certificates";

const SHAPES = [...CUT_SHAPES, "Princess", "Radiant", "Heart"];
const COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O-P", "Q-R", "S-T", "U-V", "W-X", "Y-Z", "Fancy"];
const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];
const GRADES = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
const FLUORESCENCE = ["None", "Faint", "Medium", "Strong", "Very Strong"];
const CULETS = ["None", "Very Small", "Small", "Medium", "Slightly Large", "Large", "Very Large", "Extremely Large"];

export type AttributeDef = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN";
  options: string[];
  cutStyle: string | null;
};

type Defaults = {
  certified: boolean;
  certLab: string | null;
  certNumber: string | null;
  certDate: string | null;
  saleType: string | null;
  cutStyle: string | null;
  shape: string | null;
  caratWeight: number | null;
  color: string | null;
  clarity: string | null;
  cutGrade: string | null;
  polishGrade: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  measurements: string | null;
  lengthMm: string | null;
  widthMm: string | null;
  depthMm: string | null;
  tablePct: string | null;
  depthPct: string | null;
  girdle: string | null;
  culet: string | null;
  crownAngle: string | null;
  crownHeight: string | null;
  pavilionAngle: string | null;
  pavilionDepth: string | null;
  attributes: Record<string, string | number | boolean>;
  notes: string | null;
};

export function EditPolishedStoneForm({
  id,
  defaults,
  attributeDefs,
}: {
  id: string;
  defaults: Defaults;
  attributeDefs: AttributeDef[];
}) {
  const boundAction = updatePolishedStone.bind(null, id);
  const [error, onSubmit, pending] = useFormAction(boundAction, undefined);
  const [certified, setCertified] = useState(defaults.certified);
  const [cutStyle, setCutStyle] = useState(defaults.cutStyle ?? "");
  const attrs = attributeDefs.filter((d) => !d.cutStyle || d.cutStyle === cutStyle);
  const knownLab = CERT_LABS.some((l) => l.value === (defaults.certLab ?? "").toUpperCase());

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Certification
        </legend>
        <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="certified"
            value="true"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            className="h-5 w-5"
          />
          This stone is certified
        </label>
        {certified && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="certLab" className="block text-sm font-medium text-zinc-700">
                Lab
              </label>
              <select
                id="certLab"
                name="certLab"
                defaultValue={knownLab ? (defaults.certLab ?? "").toUpperCase() : defaults.certLab ? defaults.certLab : ""}
                className={INPUT}
              >
                <option value="">—</option>
                {CERT_LABS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
                {!knownLab && defaults.certLab && <option value={defaults.certLab}>{defaults.certLab}</option>}
              </select>
            </div>
            <Field label="Report number" name="certNumber" defaultValue={defaults.certNumber ?? ""} inputMode="numeric" />
            <Field label="Report date" name="certDate" type="date" defaultValue={defaults.certDate ?? ""} />
          </div>
        )}
        <div>
          <label htmlFor="saleType" className="block text-sm font-medium text-zinc-700">
            Sale type
          </label>
          <select id="saleType" name="saleType" defaultValue={defaults.saleType ?? ""} className={`${INPUT} max-w-xs`}>
            <option value="">—</option>
            {SALE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            How it&apos;s actually sold — a certified stone can still go out in a loose parcel rather
            than being marketed on its own.
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Grading
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cutStyle" className="block text-sm font-medium text-zinc-700">
              Cut style
            </label>
            <select
              id="cutStyle"
              name="cutStyle"
              value={cutStyle}
              onChange={(e) => setCutStyle(e.target.value)}
              className={INPUT}
            >
              <option value="">—</option>
              {CUT_STYLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Select label="Shape" name="shape" options={SHAPES} defaultValue={defaults.shape ?? ""} />
          <Field label="Carat weight" name="caratWeight" type="number" step="0.001" min={0} defaultValue={defaults.caratWeight ?? undefined} />
          <Select label="Color" name="color" options={COLORS} defaultValue={defaults.color ?? ""} />
          <Select label="Clarity" name="clarity" options={CLARITIES} defaultValue={defaults.clarity ?? ""} />
          <Select label="Cut" name="cutGrade" options={GRADES} defaultValue={defaults.cutGrade ?? ""} />
          <Select label="Polish" name="polishGrade" options={GRADES} defaultValue={defaults.polishGrade ?? ""} />
          <Select label="Symmetry" name="symmetry" options={GRADES} defaultValue={defaults.symmetry ?? ""} />
          <Select label="Fluorescence" name="fluorescence" options={FLUORESCENCE} defaultValue={defaults.fluorescence ?? ""} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Measurements &amp; proportions
        </legend>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Length mm" name="lengthMm" type="number" step="0.01" min={0} defaultValue={defaults.lengthMm ?? ""} />
          <Field label="Width mm" name="widthMm" type="number" step="0.01" min={0} defaultValue={defaults.widthMm ?? ""} />
          <Field label="Depth mm" name="depthMm" type="number" step="0.01" min={0} defaultValue={defaults.depthMm ?? ""} />
          <Field label="Table %" name="tablePct" type="number" step="0.1" min={0} defaultValue={defaults.tablePct ?? ""} />
          <Field label="Depth %" name="depthPct" type="number" step="0.1" min={0} defaultValue={defaults.depthPct ?? ""} />
          <Field label="Girdle" name="girdle" defaultValue={defaults.girdle ?? ""} placeholder="e.g. Thin to Medium" />
          <Field label="Crown angle °" name="crownAngle" type="number" step="0.1" min={0} defaultValue={defaults.crownAngle ?? ""} />
          <Field label="Crown height %" name="crownHeight" type="number" step="0.1" min={0} defaultValue={defaults.crownHeight ?? ""} />
          <Select label="Culet" name="culet" options={CULETS} defaultValue={defaults.culet ?? ""} />
          <Field label="Pavilion angle °" name="pavilionAngle" type="number" step="0.1" min={0} defaultValue={defaults.pavilionAngle ?? ""} />
          <Field label="Pavilion depth %" name="pavilionDepth" type="number" step="0.1" min={0} defaultValue={defaults.pavilionDepth ?? ""} />
        </div>
        <Field
          label="Measurements as on report"
          name="measurements"
          defaultValue={defaults.measurements ?? ""}
          placeholder="e.g. 6.42 - 6.48 x 3.95"
        />
      </fieldset>

      {attrs.length > 0 && (
        <fieldset className="flex flex-col gap-4 border-0 p-0">
          <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Cut details
          </legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {attrs.map((d) => {
              const name = `attr_${d.key}`;
              const value = defaults.attributes[d.key];
              if (d.type === "BOOLEAN") {
                return (
                  <label key={d.key} className="flex min-h-11 items-center gap-2 self-end text-sm text-zinc-700">
                    <input type="checkbox" name={name} defaultChecked={value === true} className="h-5 w-5" />
                    {d.label}
                  </label>
                );
              }
              if (d.type === "SELECT") {
                return <Select key={d.key} label={d.label} name={name} options={d.options} defaultValue={value != null ? String(value) : ""} />;
              }
              return (
                <Field
                  key={d.key}
                  label={d.label}
                  name={name}
                  type={d.type === "NUMBER" ? "number" : "text"}
                  step={d.type === "NUMBER" ? "any" : undefined}
                  min={d.type === "NUMBER" ? 0 : undefined}
                  defaultValue={value != null ? String(value) : ""}
                />
              );
            })}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <input id="notes" name="notes" type="text" defaultValue={defaults.notes ?? ""} placeholder="Optional" className={INPUT} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  step,
  min,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  step?: string;
  min?: number;
  inputMode?: "numeric" | "decimal";
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
        inputMode={inputMode}
        className={INPUT}
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
  // Keep a stored value that isn't in today's list rather than dropping it.
  const all = defaultValue && !options.includes(defaultValue) ? [defaultValue, ...options] : options;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={INPUT}>
        <option value="">—</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
