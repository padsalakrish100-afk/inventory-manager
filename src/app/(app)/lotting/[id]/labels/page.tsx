import { redirect } from "next/navigation";

// Lot labels now use the shared QR sticker page.
export default async function LotLabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/stones/labels?lot=${encodeURIComponent(id)}`);
}
