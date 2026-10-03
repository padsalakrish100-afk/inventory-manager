import Papa from "papaparse";
import { Zip, ZipDeflate } from "fflate";
import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

// Large databases take a while; the zip is streamed as it's built.
export const maxDuration = 300;

const BATCH = 5000;

// Never exported: login secrets and the raw bytes of stored files (their
// details are in Attachment; the files themselves stay in storage).
const SKIP_COLUMNS: Record<string, string[]> = {
  User: ["passwordHash"],
  AttachmentData: ["data", "thumb"],
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") {
    if (v instanceof Uint8Array) return "";
    // Prisma Decimal, JSON values and arrays.
    if ("toFixed" in v && typeof (v as { toString: () => string }).toString === "function" && !Array.isArray(v)) return String(v);
    return JSON.stringify(v);
  }
  return String(v);
}

// Admin only: every table as a CSV file inside one zip — a full copy of the
// business data for safekeeping or an accountant. Neon's point-in-time
// restore is the real backup; see docs/backup-restore.md.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!can(viewer, "admin")) return new Response("Forbidden", { status: 403 });

  const tables = (
    await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
      ORDER BY table_name`
  ).map((t) => t.table_name);
  const columnsOf = new Map<string, string[]>();
  for (const row of await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`) {
    columnsOf.set(row.table_name, [...(columnsOf.get(row.table_name) ?? []), row.column_name]);
  }

  await writeAudit(prisma, viewer.id, { action: "EXPORT", entity: "Database", entityId: "all", after: { tables: tables.length } });

  const stamp = new Date().toISOString().slice(0, 10);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        const encoder = new TextEncoder();
        for (const table of tables) {
          // Table and column names come from the database catalog, quoted.
          const columns = (columnsOf.get(table) ?? []).filter((c) => !SKIP_COLUMNS[table]?.includes(c));
          if (columns.length === 0) continue;
          const file = new ZipDeflate(`${table}.csv`, { level: 6 });
          zip.add(file);
          file.push(encoder.encode(`﻿${Papa.unparse([columns])}\r\n`));
          const select = columns.map((c) => `"${c.replaceAll('"', '""')}"`).join(", ");
          const order = columns.includes("id") ? `"id"` : "1";
          for (let offset = 0; ; offset += BATCH) {
            const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
              `SELECT ${select} FROM "${table.replaceAll('"', '""')}" ORDER BY ${order} LIMIT ${BATCH} OFFSET ${offset}`,
            );
            if (rows.length > 0) {
              file.push(encoder.encode(`${Papa.unparse(rows.map((r) => columns.map((c) => cell(r[c]))))}\r\n`));
            }
            if (rows.length < BATCH) break;
          }
          file.push(new Uint8Array(0), true);
        }
        const readme = new ZipDeflate("README.txt", { level: 6 });
        zip.add(readme);
        readme.push(
          encoder.encode(
            `Inventory Manager data export, ${new Date().toISOString()}\r\nOne CSV per database table (UTF-8). Dates are UTC (ISO 8601); money and weights are exact decimals.\r\nLeft out: user password hashes and the bytes of uploaded files.\r\n`,
          ),
          true,
        );
        zip.end();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="inventory-manager-data-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
