import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";

export default async function FinancePage() {
  await requirePagePermission("sales.manage");
  redirect("/finance/receivables");
}
