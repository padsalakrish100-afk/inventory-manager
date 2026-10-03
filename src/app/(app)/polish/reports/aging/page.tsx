import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";

// Replaced by Reports → Stock aging.
export default async function PolishAgingPage() {
  await requirePagePermission("stock.view");
  redirect("/reports/stock-aging");
}
