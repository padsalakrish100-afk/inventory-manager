"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { updateKarigar } from "../actions";
import { KarigarFields } from "../karigar-fields";
import { compressPhoto } from "@/lib/image-compress";

export function EditKarigarForm({
  partyId,
  active,
  departments,
  defaults,
}: {
  partyId: string;
  active: boolean;
  departments: { id: string; name: string }[];
  defaults: { phone: string; employeeCode: string; joiningDate: string; notes: string; departmentIds: string[] };
}) {
  const [message, dispatch, pending] = useActionState(updateKarigar.bind(null, partyId), undefined);
  const [photo, setPhoto] = useState<{ photo: File; thumb: File; preview: string } | null>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const { photo: p, thumb } = await compressPhoto(file);
    setPhoto({ photo: p, thumb, preview: URL.createObjectURL(thumb) });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photoPicker");
    if (photo) {
      formData.set("photo", photo.photo);
      formData.set("photoThumb", photo.thumb);
    }
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={photo.preview} alt="New photo" className="h-14 w-14 rounded-full object-cover" />
        )}
        <label className="min-h-11 cursor-pointer rounded-md border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">
          {photo ? "Change photo" : "Upload photo"}
          <input
            name="photoPicker"
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
        </label>
      </div>
      <KarigarFields departments={departments} defaults={defaults} />
      <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 px-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4" />
        Active (shows in issue lists)
      </label>
      {message && <p className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
