import { can, getViewer, type Permission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { readAttachmentBlob } from "@/lib/storage";

// Who may open an attachment, by what it's attached to.
const VIEW_PERMISSION: Record<string, Permission> = {
  BREAKAGE: "stones.view",
  KARIGAR_PHOTO: "karigars.manage",
  ROUGH_INVOICE: "costs.view",
  ROUGH_KP: "lots.manage",
  STONE_PLAN: "stones.view",
  STONE_MEDIA: "stones.view",
  POLISH_CERT: "stock.view",
};

// Serves an uploaded file after checking the viewer may see the record it
// belongs to. ?thumb=1 returns the thumbnail when one exists.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment || attachment.deletedAt) return new Response("Not found", { status: 404 });

  const permission = VIEW_PERMISSION[attachment.entityType] ?? "admin";
  if (!can(viewer, permission)) return new Response("Forbidden", { status: 403 });

  const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
  // Images and PDFs open in the browser; anything else (plan files etc.)
  // downloads, and is never sniffed into something executable.
  const viewable = attachment.mime.startsWith("image/") || attachment.mime === "application/pdf";
  // Quotes and line breaks removed so a file name can't break the header.
  const safeFileName = (attachment.fileName ?? "file").replace(/["\r\n]/g, "");
  const headers = {
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${viewable ? "inline" : "attachment"}; filename="${safeFileName}"`,
  };

  if (attachment.url === "db") {
    const data = await prisma.attachmentData.findUnique({ where: { attachmentId: id } });
    if (!data) return new Response("Not found", { status: 404 });
    const bytes = new Uint8Array(wantThumb && data.thumb ? data.thumb : data.data);
    const type = wantThumb && data.thumb ? "image/jpeg" : attachment.mime;
    // Byte ranges, so stored videos can seek and play on iPhones.
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const size = bytes.length;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(bytes, { headers: { ...headers, "Content-Type": type, "Accept-Ranges": "bytes" } });
  }

  const blobUrl = wantThumb && attachment.thumbUrl ? attachment.thumbUrl : attachment.url;
  const blob = await readAttachmentBlob(blobUrl, wantThumb ? null : request.headers.get("range"));
  if (!blob) return new Response("Not found", { status: 404 });
  return new Response(blob.stream, {
    status: blob.contentRange ? 206 : 200,
    headers: {
      ...headers,
      "Content-Type": blob.contentType ?? attachment.mime,
      "Accept-Ranges": "bytes",
      ...(blob.contentRange ? { "Content-Range": blob.contentRange } : {}),
      ...(blob.contentLength ? { "Content-Length": blob.contentLength } : {}),
    },
  });
}
