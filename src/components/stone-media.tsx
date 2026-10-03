"use client";

import { useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { compressPhoto } from "@/lib/image-compress";
import { registerStoneMedia, removeStoneMedia, uploadStoneMedia } from "@/app/(app)/stones/media-actions";

type Media = { id: string; kind: string; fileName: string | null; hasThumb: boolean };

// A frame from the video as a small JPEG poster, made in the browser.
async function videoPoster(file: File): Promise<File | null> {
  try {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("no video"));
    });
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.7));
    return blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}

// Photos and videos of a stone: gallery plus upload (camera on phones).
export function StoneMedia({
  stoneId,
  media,
  canEdit,
  directUpload,
}: {
  stoneId: string;
  media: Media[];
  canEdit: boolean;
  directUpload: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).slice(0, 6);
    const smallForm = new FormData();
    let smallCount = 0;

    for (const [i, f] of list.entries()) {
      setBusy(`Preparing ${i + 1} of ${list.length}…`);
      if (f.type.startsWith("image/")) {
        const { photo, thumb } = await compressPhoto(f);
        smallForm.append("files", photo);
        smallForm.append("thumbs", thumb);
        smallCount++;
      } else if (f.type.startsWith("video/")) {
        const poster = await videoPoster(f);
        if (directUpload) {
          setBusy(`Uploading video ${i + 1} of ${list.length}…`);
          try {
            const blob = await upload(`stone-media/${stoneId}/${f.name.replace(/[^\w.-]+/g, "_")}`, f, {
              access: "private",
              handleUploadUrl: "/api/uploads/blob",
              contentType: f.type,
            });
            const form = new FormData();
            if (poster) form.append("thumb", poster);
            const r = await registerStoneMedia({ stoneId, url: blob.url, fileName: f.name }, form);
            if (r.error) setError(r.error);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Video upload failed.");
          }
        } else {
          smallForm.append("files", f);
          smallForm.append("thumbs", poster ?? new File([], "none.jpg", { type: "image/jpeg" }));
          smallCount++;
        }
      } else {
        setError(`${f.name}: only photos and videos.`);
      }
    }

    if (smallCount > 0) {
      setBusy("Uploading…");
      const r = await uploadStoneMedia(stoneId, smallForm);
      if (r.error) setError(r.error);
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {media.map((m) => (
          <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            <a href={`/api/attachments/${m.id}`} target="_blank" rel="noreferrer" className="block h-full w-full">
              {m.hasThumb || m.kind === "PHOTO" ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated attachment route
                <img src={`/api/attachments/${m.id}?thumb=1`} alt={m.fileName ?? "Stone media"} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-zinc-500">Video</span>
              )}
              {m.kind === "VIDEO" && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">▶ video</span>
              )}
            </a>
            {canEdit && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("Remove this from the stone?")) return;
                  startTransition(async () => {
                    const r = await removeStoneMedia(m.id);
                    if (r.error) setError(r.error);
                  });
                }}
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/60 text-xs text-white"
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-500">
            {busy ?? "+ Photo / video"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={Boolean(busy)}
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {media.length === 0 && !canEdit && <p className="text-sm text-zinc-500">No photos or videos yet.</p>}
      {canEdit && !directUpload && (
        <p className="text-xs text-zinc-400">Videos up to 3 MB until a Blob store is connected.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
