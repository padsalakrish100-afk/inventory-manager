"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { recordBreakage } from "../../actions";
import { compressPhoto } from "@/lib/image-compress";
import { BREAKAGE_REASONS } from "@/lib/manufacturing/conditions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function BreakageForm({
  stoneId,
  currentWeight,
  karigarNames,
  defaultHandler,
  isOut,
}: {
  stoneId: string;
  currentWeight: number | null;
  karigarNames: string[];
  defaultHandler: string | null;
  isOut: boolean;
}) {
  const [error, dispatch, pending] = useActionState(recordBreakage, undefined);
  const [reasonChoice, setReasonChoice] = useState<string>(BREAKAGE_REASONS[0]);
  const [photos, setPhotos] = useState<{ photo: File; thumb: File; preview: string }[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    setCompressing(true);
    try {
      const added: { photo: File; thumb: File; preview: string }[] = [];
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        const { photo, thumb } = await compressPhoto(file);
        added.push({ photo, thumb, preview: URL.createObjectURL(thumb) });
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch {
      setPhotoError("Couldn't read that photo — try another.");
    } finally {
      setCompressing(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photoPicker");
    if (reasonChoice !== "Other") formData.set("reason", reasonChoice);
    for (const p of photos) {
      formData.append("photos", p.photo);
      formData.append("thumbs", p.thumb);
    }
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="stoneId" value={stoneId} />

      <div>
        <span className="block text-sm font-medium text-zinc-700">Reason</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {BREAKAGE_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReasonChoice(r)}
              className={`min-h-11 rounded-md border px-3 text-sm ${
                reasonChoice === r ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {reasonChoice === "Other" && (
          <input name="reason" required placeholder="Describe what happened" className={inputClass} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Weight before (ct)
          <input
            name="weightBefore"
            type="number"
            inputMode="decimal"
            step="0.001"
            min={0}
            required
            defaultValue={currentWeight ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Weight after (ct)
          <input name="weightAfter" type="number" inputMode="decimal" step="0.001" min={0} required className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Handled by (karigar)
          <input
            name="handledBy"
            list="breakage-karigars"
            defaultValue={defaultHandler ?? ""}
            placeholder="Who had the stone"
            className={inputClass}
          />
          <datalist id="breakage-karigars">
            {karigarNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input name="date" type="date" defaultValue={todayIST()} className={inputClass} />
        </label>
      </div>

      {!isOut && (
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-800">
          <input type="checkbox" name="totalLoss" className="h-4 w-4" />
          Total loss — the stone can&apos;t continue (marks it Broken)
        </label>
      )}

      <div>
        <span className="block text-sm font-medium text-zinc-700">Photos (up to 4)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-zinc-900 text-xs text-white"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-500">
              {compressing ? "…" : "+ Photo"}
              <input
                name="photoPicker"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
      </div>

      <input name="notes" placeholder="Notes (optional)" className={inputClass} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || compressing}
        className="min-h-12 w-full rounded-md bg-red-700 px-4 py-3 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Record breakage"}
      </button>
    </form>
  );
}
