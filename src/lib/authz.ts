import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// The app's roles. STAFF is the pre-ERP role still stored on older user
// rows; it is treated exactly like MANAGER everywhere.
export type AppRole = "ADMIN" | "MANAGER" | "OPERATOR" | "SALES";

export type Viewer = {
  id: string;
  name: string;
  role: AppRole;
  canSeeCosts: boolean;
  departmentIds: string[];
};

export type Permission =
  | "stones.view" // stone list, stone hub, scanner, labels
  | "stones.edit" // move location, transfer to Polish, undo/delete mistakes
  | "lots.manage" // Lotting
  | "mfg.view" // Manufacturing pages
  | "mfg.issueReturn" // Issue / return (operators: own departments only)
  | "mfg.reports"
  | "plans.edit" // stone plans (planned shape/weight/value, Sarine files)
  | "karigars.manage" // karigar master, rate cards, job-work (amounts also need costs.view)
  | "stock.view" // Polish / polished stock
  | "stock.edit"
  | "sales.reports"
  | "memo.manage" // sales memos (consignment): issue, return
  | "sales.manage" // invoices, receipts, receivables
  | "costs.view" // cost, profit, rough price, labour amounts
  | "admin"; // settings, parties, users, audit log

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: [
    "stones.view",
    "stones.edit",
    "lots.manage",
    "mfg.view",
    "mfg.issueReturn",
    "mfg.reports",
    "plans.edit",
    "karigars.manage",
    "stock.view",
    "stock.edit",
    "sales.reports",
    "memo.manage",
    "sales.manage",
    "costs.view",
    "admin",
  ],
  MANAGER: [
    "stones.view",
    "stones.edit",
    "lots.manage",
    "mfg.view",
    "mfg.issueReturn",
    "mfg.reports",
    "plans.edit",
    "karigars.manage",
    "stock.view",
    "stock.edit",
    "sales.reports",
    "memo.manage",
    "sales.manage",
  ],
  OPERATOR: ["stones.view", "mfg.view", "mfg.issueReturn", "plans.edit"],
  SALES: ["stones.view", "stock.view", "memo.manage"],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Owner / Admin",
  MANAGER: "Manager",
  OPERATOR: "Department operator",
  SALES: "Viewer / Sales",
};

export function normalizeRole(role: string): AppRole {
  if (role === "ADMIN" || role === "MANAGER" || role === "OPERATOR" || role === "SALES") return role;
  return "MANAGER"; // STAFF and anything unexpected
}

export function can(viewer: Viewer | null, permission: Permission): boolean {
  if (!viewer) return false;
  if (permission === "costs.view") {
    return viewer.role === "ADMIN" || (viewer.role === "MANAGER" && viewer.canSeeCosts);
  }
  return ROLE_PERMISSIONS[viewer.role].includes(permission);
}

// Re-read from the database on every request (memoized per request) so a
// role change or deactivation applies immediately, not at next sign-in.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      canSeeCosts: true,
      departments: { select: { departmentId: true } },
    },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    role: normalizeRole(user.role),
    canSeeCosts: user.canSeeCosts,
    departmentIds: user.departments.map((d) => d.departmentId),
  };
});

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// For server actions and route handlers: throws instead of redirecting so
// the caller sees a clear failure.
export async function requirePermission(permission: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!can(viewer, permission)) throw new ForbiddenError();
  return viewer;
}

// For pages: sends the user to their home page instead of rendering.
export async function requirePagePermission(permission: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!can(viewer, permission)) redirect(homePathFor(viewer));
  return viewer;
}

export function homePathFor(viewer: Viewer): string {
  switch (viewer.role) {
    case "OPERATOR":
      return "/scan";
    case "SALES":
      return "/polish";
    default:
      return "/manufacturing";
  }
}

// Operators may only issue/return within their assigned departments.
// A stage with no department is open to every operator.
export function canWorkInDepartment(viewer: Viewer, departmentId: string | null | undefined): boolean {
  if (viewer.role !== "OPERATOR") return can(viewer, "mfg.issueReturn");
  if (!departmentId) return true;
  return viewer.departmentIds.includes(departmentId);
}
