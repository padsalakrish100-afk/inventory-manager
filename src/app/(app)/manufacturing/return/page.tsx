import { requirePagePermission } from "@/lib/authz";
import { ReturnForm } from "./return-form";

export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  await requirePagePermission("mfg.issueReturn");
  const { sku } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Return from process</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Scan stones coming back from a karigar or vendor to free them up for the next step.
        </p>
      </div>
      <ReturnForm initialSku={sku} />
    </div>
  );
}
