"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { createAttribute, updateAttribute } from "../actions";
import { CUT_STYLES } from "@/lib/cuts";

export type AttributeDefaults = {
  label: string;
  cutStyle: string | null;
  type: string;
  options: string[];
  sortOrder: number;
  active: boolean;
};

const TYPE_LABELS: Record<string, string> = { TEXT: "Text", NUMBER: "Number", SELECT: "Choice list", BOOLEAN: "Yes / no" };

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

// One field as an editable card, or (without `attributeId`) the "add field" form.
export function AttributeForm({ attributeId, attrKey, defaults }: { attributeId?: string; attrKey?: string; defaults: AttributeDefaults }) {
  const action = attributeId ? updateAttribute.bind(null, attributeId) : createAttribute;
  const [message, onSubmit, pending] = useFormAction(action, undefined, { resetOnSuccess: !attributeId });
  const [type, setType] = useState(defaults.type);

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${defaults.active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-70"}`}
    >
      {attrKey && (
        <p className="font-mono text-xs text-zinc-400">
          {attrKey} · {TYPE_LABELS[defaults.type] ?? defaults.type}
        </p>
      )}
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Label</label>
          <input name="label" required defaultValue={defaults.label} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Order</label>
          <input name="sortOrder" type="number" inputMode="numeric" defaultValue={defaults.sortOrder} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Shown for</label>
          <select name="cutStyle" defaultValue={defaults.cutStyle ?? ""} className={inputClass}>
            <option value="">Every cut style</option>
            {CUT_STYLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {!attributeId && (
          <div>
            <label className="block text-xs font-medium text-zinc-500">Field type</label>
            <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {type === "SELECT" && (
        <div>
          <label className="block text-xs font-medium text-zinc-500">Choices (comma-separated)</label>
          <input name="options" defaultValue={defaults.options.join(", ")} placeholder="e.g. High, Medium, Low" className={inputClass} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="active" defaultChecked={defaults.active} className="h-4 w-4" />
          Active
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving..." : attributeId ? "Save" : "Add field"}
        </button>
      </div>
      {message && <p className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
    </form>
  );
}
