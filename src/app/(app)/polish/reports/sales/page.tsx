import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";

// Replaced by Reports → Sales report (from invoices).
export default async function PolishSalesPage() {
  await requirePagePermission("sales.reports");
  redirect("/reports/sales");
}
