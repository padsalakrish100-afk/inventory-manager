import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { can, getViewer } from "@/lib/authz";
import { blobStoreEnabled } from "@/lib/storage";

// Issues short-lived tokens so a phone can upload a stone's photo or video
// straight to the private Blob store (videos are too big to pass through a
// server function). The upload is only recorded on the stone afterwards by
// registerStoneMedia, which re-checks it.
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const MAX_BYTES = 250 * 1024 * 1024;

export async function POST(request: Request) {
  if (!blobStoreEnabled()) return Response.json({ error: "Blob storage isn't configured." }, { status: 400 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(viewer, "stock.edit")) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Only into a stone's media folder: stone-media/<stoneId>/<file>.
        if (!/^stone-media\/[a-z0-9]{10,40}\/[^/]+$/i.test(pathname)) throw new Error("Invalid upload path.");
        return { allowedContentTypes: MEDIA_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Upload refused." }, { status: 400 });
  }
}
