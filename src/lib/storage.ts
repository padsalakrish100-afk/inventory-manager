import "server-only";
import { get, put } from "@vercel/blob";
import type { Tx } from "@/lib/audit";

// Uploaded files (photos, PDFs, plan files). With BLOB_READ_WRITE_TOKEN set
// (Vercel Blob store connected) files go to a *private* blob store; without
// it they're kept in the database (AttachmentData) — fine for local
// development and small volumes. Either way they're only ever served through
// /api/attachments/[id], which checks the viewer's permissions.

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES = ["application/pdf"];

export function blobStoreEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export type UploadInput = {
  entityType: string;
  entityId: string;
  kind: string;
  file: File;
  thumb?: File | null;
  uploadedById: string;
};

// Files that must never be stored and served back (they could run in a
// browser or on a PC). Everything else is allowed for "any" uploads such as
// Sarine/Galaxy plan files, whose formats browsers don't recognise.
const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|js|mjs|html?|svg|xhtml|php|sh|jar)$/i;
const BLOCKED_TYPES = ["text/html", "image/svg+xml", "application/javascript", "text/javascript", "application/x-msdownload"];

export function validateUpload(file: File, allow: "image" | "image-or-pdf" | "any"): string | null {
  if (allow === "any") {
    if (BLOCKED_EXTENSIONS.test(file.name) || BLOCKED_TYPES.includes(file.type)) {
      return `${file.name || "File"}: this kind of file can't be uploaded.`;
    }
  } else {
    const allowed = allow === "image" ? IMAGE_TYPES : [...IMAGE_TYPES, ...DOCUMENT_TYPES];
    if (!allowed.includes(file.type)) return `${file.name || "File"}: unsupported file type.`;
  }
  if (file.size === 0) return `${file.name || "File"} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name || "File"} is larger than 3 MB.`;
  return null;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

// Stores the file and creates its Attachment row inside the caller's
// transaction (blob upload happens first; an orphaned blob on rollback is
// harmless, an orphaned row would not be).
export async function saveAttachment(tx: Tx, input: UploadInput) {
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const thumbBytes = input.thumb ? Buffer.from(await input.thumb.arrayBuffer()) : null;
  const pathname = `${input.entityType.toLowerCase()}/${input.entityId}/${Date.now()}-${safeName(input.file.name)}`;

  let url = "db";
  let thumbUrl: string | null = null;
  if (blobStoreEnabled()) {
    const main = await put(pathname, bytes, {
      access: "private",
      contentType: input.file.type || "application/octet-stream",
      addRandomSuffix: true,
    });
    url = main.url;
    if (thumbBytes) {
      const t = await put(`${pathname}.thumb.jpg`, thumbBytes, {
        access: "private",
        contentType: "image/jpeg",
        addRandomSuffix: true,
      });
      thumbUrl = t.url;
    }
  }

  const attachment = await tx.attachment.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      kind: input.kind,
      url,
      thumbUrl,
      fileName: input.file.name || null,
      mime: input.file.type || "application/octet-stream",
      sizeBytes: bytes.length,
      uploadedById: input.uploadedById,
    },
  });
  if (!blobStoreEnabled()) {
    await tx.attachmentData.create({ data: { attachmentId: attachment.id, data: bytes, thumb: thumbBytes } });
  }
  return attachment;
}

// Streams a private blob. A Range header is passed through so videos can
// seek (iPhones won't play video without range support).
export async function readAttachmentBlob(
  url: string,
  range: string | null = null,
): Promise<{ stream: ReadableStream; contentType: string | null; contentRange: string | null; contentLength: string | null } | null> {
  const result = await get(url, { access: "private", ...(range ? { headers: { Range: range } } : {}) });
  if (!result || !result.stream) return null;
  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    contentRange: result.headers.get("content-range"),
    contentLength: result.headers.get("content-length"),
  };
}
