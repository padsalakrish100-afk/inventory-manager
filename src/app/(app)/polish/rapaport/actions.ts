"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit } from "@/lib/audit";
import { parseRapCsv } from "@/lib/rapaport";
import { parseInput, zDateString } from "@/lib/validation";

const MAX_BYTES = 5 * 1024 * 1024;

// Uploads a Rapaport price list you exported/downloaded yourself as CSV.
// The newest list (by effective date) is the one used for "vs Rap".
export async function uploadRapaportList(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("stock.edit");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose the CSV file.";
  if (file.size > MAX_BYTES) return "The file is larger than 5 MB.";
  if (!/\.(csv|txt)$/i.test(file.name)) return "Upload a .csv file.";
  const date = parseInput(zDateString("Effective date"), String(formData.get("effectiveDate") ?? ""));
  if (!date.ok) return date.error;
  if (!date.data) return "Enter the list's effective date.";

  const text = await file.text();
  const csv = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const parsed = parseRapCsv(csv.data);
  if (parsed.error) return parsed.error;
  if (parsed.rows.length === 0) return "No usable price rows found.";

  await prisma.$transaction(async (tx) => {
    const list = await tx.rapaportList.create({
      data: {
        effectiveDate: new Date(`${date.data}T00:00:00Z`),
        fileName: file.name,
        rowCount: parsed.rows.length,
        uploadedById: viewer.id,
      },
    });
    for (let i = 0; i < parsed.rows.length; i += 2000) {
      await tx.rapaportPrice.createMany({ data: parsed.rows.slice(i, i + 2000).map((r) => ({ ...r, listId: list.id })) });
    }
    await writeAudit(tx, viewer.id, {
      action: "CREATE",
      entity: "RapaportList",
      entityId: list.id,
      after: { fileName: file.name, effectiveDate: date.data, rows: parsed.rows.length, skipped: parsed.skipped },
    });
  }, TX_OPTIONS);

  revalidatePath("/polish/rapaport");
  revalidatePath("/polish");
  return `Saved ${parsed.rows.length} prices${parsed.skipped ? ` (${parsed.skipped} unusable rows skipped)` : ""}.`;
}
