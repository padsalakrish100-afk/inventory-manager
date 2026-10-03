import { redirect } from "next/navigation";
import { can, requirePagePermission } from "@/lib/authz";

// Replaced by Costing → Inventory value (cost viewers) and Reports → Stock list.
export default async function PolishInventoryValuePage() {
  const viewer = await requirePagePermission("stock.view");
  redirect(can(viewer, "costs.view") ? "/costing" : "/reports/stock-list");
}
