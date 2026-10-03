import Link from "next/link";
import { requirePagePermission } from "@/lib/authz";

export default async function DataExportPage() {
  await requirePagePermission("admin");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Export all data</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Downloads every table — stones, movements, costs, karigars, memos, invoices, payments, audit log and the rest —
          as CSV files in one zip. Open them in Excel or give them to your accountant. User passwords and the uploaded
          files themselves (photos, certificates) are not included.
        </p>
        <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>
      <a
        href="/api/admin/export"
        className="min-h-12 self-start rounded-md bg-[var(--accent)] px-5 py-3 text-base font-medium text-white hover:brightness-110"
      >
        Download zip
      </a>
      <p className="text-sm text-zinc-500">
        This is a copy for safekeeping, not the main backup. The database itself is backed up continuously by Neon and
        can be restored to any moment in the retention window — see <span className="font-mono">docs/backup-restore.md</span>.
        Each download is recorded in the audit log.
      </p>
    </div>
  );
}
