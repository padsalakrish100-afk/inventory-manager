"use server";

import { revalidatePath } from "next/cache";
import { head, put } from "@vercel/blob";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { blobStoreEnabled, saveAttachment, validateUpload } from "@/lib/storage";
import { parseInput, zId } from "@/lib/validation";

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function revalidateStone(stoneId: string, polishedId: string | null) {
  revalidatePath(`/stones/${stoneId}`);
  if (polishedId) revalidatePath(`/polish/${polishedId}`);
  revalidatePath("/polish");
}

async function polishedIdOf(stoneId: string): Promise<string | null> {
  return (await prisma.polishedStone.findUnique({ where: { sourceProductId: stoneId }, select: { id: true } }))?.id ?? null;
}

// Photos (already compressed in the browser) and small videos sent through
// the server — used when no Blob store is connected, and for photos always.
export async function uploadStoneMedia(stoneId: string, formData: FormData): Promise<{ error?: string; added?: number }> {
  const viewer = await requirePermission("stock.edit");
  if (!parseInput(zId, stoneId).ok) return { error: "Invalid stone." };
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  // One thumbs entry per file, in the same order (empty when none was made).
  const thumbs = formData.getAll("thumbs").map((f) => (f instanceof File && f.size > 0 ? f : null));
  if (thumbs.length !== files.length) return { error: "Upload was incomplete — try again." };
  for (const t of thumbs) if (t && validateUpload(t, "image")) return { error: "Invalid thumbnail." };
  if (files.length === 0) return { error: "Choose a photo or video." };
  if (files.length > 6) return { error: "Upload at most 6 at a time." };
  for (const f of files) {
    if (VIDEO_TYPES.includes(f.type)) {
      if (f.size > 3 * 1024 * 1024) {
        return { error: `${f.name}: videos over 3 MB need the Blob store connected (see docs/development.md).` };
      }
    } else {
      const problem = validateUpload(f, "image");
      if (problem) return { error: problem };
    }
  }
  if (!(await prisma.product.findUnique({ where: { id: stoneId }, select: { id: true } }))) return { error: "Stone not found." };

  await prisma.$transaction(async (tx) => {
    for (const [i, f] of files.entries()) {
      const a = await saveAttachment(tx, {
        entityType: "STONE_MEDIA",
        entityId: stoneId,
        kind: VIDEO_TYPES.includes(f.type) ? "VIDEO" : "PHOTO",
        file: f,
        thumb: thumbs[i] ?? null,
        uploadedById: viewer.id,
      });
      await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Attachment", entityId: a.id, after: a });
    }
  }, TX_OPTIONS);

  revalidateStone(stoneId, await polishedIdOf(stoneId));
  return { added: files.length };
}

const registerSchema = z.object({
  stoneId: zId,
  url: z.string().url().max(1000),
  fileName: z.string().max(200),
});

// Records a file the browser uploaded straight to Blob storage, after
// checking it really is in our store, in this stone's folder, and a photo or
// video. The small poster thumbnail comes with the request.
export async function registerStoneMedia(
  input: { stoneId: string; url: string; fileName: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const viewer = await requirePermission("stock.edit");
  if (!blobStoreEnabled()) return { error: "Blob storage isn't configured." };
  const parsed = parseInput(registerSchema, input);
  if (!parsed.ok) return { error: parsed.error };
  const { stoneId, url, fileName } = parsed.data;

  let info;
  try {
    info = await head(url);
  } catch {
    return { error: "Upload not found." };
  }
  if (!info.pathname.startsWith(`stone-media/${stoneId}/`)) return { error: "That upload belongs to another stone." };
  const type = info.contentType ?? "";
  if (![...VIDEO_TYPES, ...IMAGE_TYPES].includes(type)) return { error: "Only photos and videos." };

  const thumb = formData.get("thumb");
  let thumbUrl: string | null = null;
  if (thumb instanceof File && thumb.size > 0) {
    if (validateUpload(thumb, "image")) return { error: "Invalid thumbnail." };
    thumbUrl = (
      await put(`stone-media/${stoneId}/thumb-${Date.now()}.jpg`, Buffer.from(await thumb.arrayBuffer()), {
        access: "private",
        contentType: "image/jpeg",
        addRandomSuffix: true,
      })
    ).url;
  }

  await prisma.$transaction(async (tx) => {
    const a = await tx.attachment.create({
      data: {
        entityType: "STONE_MEDIA",
        entityId: stoneId,
        kind: VIDEO_TYPES.includes(type) ? "VIDEO" : "PHOTO",
        url,
        thumbUrl,
        fileName,
        mime: type,
        sizeBytes: info.size,
        uploadedById: viewer.id,
      },
    });
    await writeAudit(tx, viewer.id, { action: "CREATE", entity: "Attachment", entityId: a.id, after: a });
  });
  revalidateStone(stoneId, await polishedIdOf(stoneId));
  return {};
}

export async function removeStoneMedia(attachmentId: string): Promise<{ error?: string }> {
  const viewer = await requirePermission("stock.edit");
  const before = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!before || before.deletedAt || before.entityType !== "STONE_MEDIA") return { error: "Not found." };
  await prisma.$transaction(async (tx) => {
    const after = await tx.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });
    await writeAudit(tx, viewer.id, { action: "DELETE", entity: "Attachment", entityId: attachmentId, before, after });
  });
  revalidateStone(before.entityId, await polishedIdOf(before.entityId));
  return {};
}
