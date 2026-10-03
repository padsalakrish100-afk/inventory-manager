import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "VOID" | "BULK_CREATE" | "BULK_UPDATE" | "EXPORT" | "UNLOCK";

const REDACTED_KEYS = new Set(["passwordHash"]);

// Turns a Prisma row into plain JSON (Decimal → string, Date → ISO string)
// with secrets removed, so it can be stored as a before/after snapshot.
function snapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => (REDACTED_KEYS.has(key) ? "[redacted]" : v)),
  ) as Prisma.InputJsonValue;
}

// Only the fields that actually changed, so an UPDATE entry reads as
// old → new instead of two full copies of the row.
function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === "updatedAt") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a };
}

export type AuditEntry = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

function toRow(userId: string | null, entry: AuditEntry) {
  let before = snapshot(entry.before);
  let after = snapshot(entry.after);

  if (entry.action === "UPDATE" && before && after && typeof before === "object" && typeof after === "object") {
    const changed = diff(before as Record<string, unknown>, after as Record<string, unknown>);
    if (Object.keys(changed.after).length === 0) return null; // nothing actually changed
    before = snapshot(changed.before);
    after = snapshot(changed.after);
  }

  return {
    userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before,
    after,
  };
}

// Writes audit rows. Pass the transaction client so the audit entries
// commit or roll back together with the changes they describe.
export async function writeAudit(
  db: Tx | typeof prisma,
  userId: string | null,
  entries: AuditEntry | AuditEntry[],
): Promise<void> {
  const rows = (Array.isArray(entries) ? entries : [entries])
    .map((e) => toRow(userId, e))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return;
  await db.auditLog.createMany({ data: rows });
}

// Interactive transactions on a remote DB need more than Prisma's 5s
// default when one action touches dozens of stones.
export const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 } as const;
