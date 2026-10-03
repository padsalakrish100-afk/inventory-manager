import { redirect } from "next/navigation";
import { can, requirePagePermission } from "@/lib/authz";

export default async function SalesPage() {
  const viewer = await requirePagePermission("memo.manage");
  redirect(can(viewer, "sales.manage") ? "/sales/invoices" : "/sales/memos");
}
