import { redirect } from "next/navigation";

// Old stone detail URL — the stone hub replaced it. Kept so existing links
// and bookmarks still work.
export default async function StoneDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/stones/${id}`);
}
