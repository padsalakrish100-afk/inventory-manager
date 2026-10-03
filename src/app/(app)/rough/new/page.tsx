import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { usdInrOn } from "@/lib/fx";
import { PurchaseForm } from "./purchase-form";

export default async function NewRoughPurchasePage() {
  const viewer = await requirePagePermission("lots.manage");
  if (!can(viewer, "costs.view")) redirect("/rough");
  const [vendors, fx] = await Promise.all([
    prisma.party.findMany({ where: { roles: { has: "VENDOR" }, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    usdInrOn(prisma, new Date()),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New rough purchase</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter the total or the price per carat — the other is worked out.</p>
      </div>
      <PurchaseForm vendorNames={vendors.map((v) => v.name)} defaultFx={fx} />
    </div>
  );
}
