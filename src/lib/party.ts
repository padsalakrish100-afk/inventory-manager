import "server-only";
import type { PartyCategory, PartyRoleType } from "@/generated/prisma/client";
import { writeAudit, type Tx } from "@/lib/audit";

export const PARTY_ROLE_VALUES = ["VENDOR", "KARIGAR", "JOB_WORKER", "CUSTOMER", "BROKER"] as const;

// The older single `category` is still read by a few screens, so it is kept
// in sync with the role list: the existing category wins if it's still
// covered by a role, otherwise the first role that maps to one.
export function categoryForRoles(roles: readonly string[], current: PartyCategory | null): PartyCategory | null {
  const covers: Record<PartyCategory, string[]> = {
    TENDER_VENDOR: ["VENDOR"],
    KARIGAR: ["KARIGAR", "JOB_WORKER"],
    CUSTOMER: ["CUSTOMER"],
  };
  if (current && covers[current].some((r) => roles.includes(r))) return current;
  for (const role of roles) {
    if (role === "VENDOR") return "TENDER_VENDOR";
    if (role === "KARIGAR" || role === "JOB_WORKER") return "KARIGAR";
    if (role === "CUSTOMER") return "CUSTOMER";
  }
  return null;
}

// Finds a party by exact name or creates it, and makes sure it carries the
// given role — the "type a new name and it's saved" behaviour used across
// issue, lotting, and sale forms.
export async function ensurePartyWithRole(
  tx: Tx,
  userId: string,
  name: string,
  role: PartyRoleType,
): Promise<{ id: string; name: string }> {
  const existing = await tx.party.findUnique({ where: { name } });
  if (!existing) {
    const created = await tx.party.create({
      data: { name, roles: [role], category: categoryForRoles([role], null) },
    });
    await writeAudit(tx, userId, { action: "CREATE", entity: "Party", entityId: created.id, after: created });
    return created;
  }
  if (!existing.roles.includes(role)) {
    const roles = [...existing.roles, role];
    const updated = await tx.party.update({
      where: { id: existing.id },
      data: { roles, category: categoryForRoles(roles, existing.category) },
    });
    await writeAudit(tx, userId, { action: "UPDATE", entity: "Party", entityId: existing.id, before: existing, after: updated });
  }
  return existing;
}
