// Browser-side photo compression: phone photos (3–8 MB) are resized and
// re-encoded as JPEG before upload, plus a small thumbnail for lists.

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function toJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );
}

export async function compressPhoto(file: File): Promise<{ photo: File; thumb: File }> {
  const bitmap = await loadBitmap(file);
  try {
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    const photo = await toJpeg(bitmap, 1600, 0.78);
    const thumb = await toJpeg(bitmap, 320, 0.7);
    return {
      photo: new File([photo], `${base}.jpg`, { type: "image/jpeg" }),
      thumb: new File([thumb], `${base}.thumb.jpg`, { type: "image/jpeg" }),
    };
  } finally {
    bitmap.close();
  }
}
