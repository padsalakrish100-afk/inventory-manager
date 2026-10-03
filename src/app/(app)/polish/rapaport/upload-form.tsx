"use client";

import { useFormAction } from "@/lib/use-form-action";
import { uploadRapaportList } from "./actions";
import { todayIST } from "@/lib/dates";

export function RapUploadForm() {
  const [message, onSubmit, pending] = useFormAction(uploadRapaportList, undefined);
  const ok = message?.startsWith("Saved");
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="text-xs font-medium text-zinc-500">
        CSV file
        <input name="file" type="file" accept=".csv,text/csv" required className="mt-1 block text-sm" />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Effective date
        <input name="effectiveDate" type="date" defaultValue={todayIST()} className="mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload list"}
      </button>
      {message && <p className={`w-full text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
    </form>
  );
}
