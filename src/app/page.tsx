import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/authz";

// Each role lands where they work most: operators on the scanner, sales on
// stock, everyone else on Manufacturing (the dashboard arrives in Phase 7).
export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  redirect(homePathFor(viewer));
}
