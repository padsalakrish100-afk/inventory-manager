import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";

// Replaced by the dashboard and the Reports hub (Phase 7).
export default async function PolishSummaryPage() {
  await requirePagePermission("stock.view");
  redirect("/reports");
}
