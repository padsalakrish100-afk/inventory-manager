"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { formToObject, parseInput, zRequiredText } from "@/lib/validation";

const ROLE_VALUES = ["ADMIN", "MANAGER", "OPERATOR", "SALES"] as const;

const accessSchema = z.object({
  role: z.enum(ROLE_VALUES, { message: "Invalid role." }),
  canSeeCosts: z.boolean(),
  departmentIds: z.array(z.string().min(1).max(64)).max(50),
});

function readAccess(raw: Record<string, string | string[]>) {
  return {
    role: typeof raw.role === "string" ? raw.role : "",
    canSeeCosts: raw.canSeeCosts === "on" || raw.canSeeCosts === "true",
    departmentIds: Array.isArray(raw["departmentIds[]"]) ? raw["departmentIds[]"] : [],
  };
}

const createSchema = accessSchema.extend({
  name: zRequiredText("Name", 100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,32}$/,
      "Username must be 3-32 characters: lowercase letters, numbers, dots, underscores, or hyphens.",
    ),
  email: z.string().trim().toLowerCase().email("Email is invalid."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function createUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");

  const raw = formToObject(formData);
  const parsed = parseInput(createSchema, {
    ...readAccess(raw),
    name: raw.name ?? "",
    username: raw.username ?? "",
    email: raw.email ?? "",
    password: raw.password ?? "",
  });
  if (!parsed.ok) return parsed.error;
  const { name, username, email, password, role, canSeeCosts, departmentIds } = parsed.data;

  const [existingUsername, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (existingUsername) return "That username is already taken.";
  if (existingEmail) return "A user with that email already exists.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role,
        canSeeCosts: role === "MANAGER" ? canSeeCosts : role === "ADMIN",
        departments:
          role === "OPERATOR" ? { create: departmentIds.map((departmentId) => ({ departmentId })) } : undefined,
      },
    });
    await writeAudit(tx, viewer.id, {
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      after: { ...user, departmentIds: role === "OPERATOR" ? departmentIds : [] },
    });
  });

  revalidatePath("/users");
}

const updateSchema = accessSchema.extend({
  name: zRequiredText("Name", 100),
  email: z.string().trim().toLowerCase().email("Email is invalid."),
  active: z.boolean(),
  newPassword: z.union([z.literal(""), z.string().min(8, "New password must be at least 8 characters.").max(200)]),
});

export async function updateUser(
  userId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const viewer = await requirePermission("admin");

  const raw = formToObject(formData);
  const parsed = parseInput(updateSchema, {
    ...readAccess(raw),
    name: raw.name ?? "",
    email: raw.email ?? "",
    active: raw.active === "on" || raw.active === "true",
    newPassword: raw.newPassword ?? "",
  });
  if (!parsed.ok) return parsed.error;
  const { name, email, role, canSeeCosts, departmentIds, active, newPassword } = parsed.data;

  if (userId === viewer.id && (role !== "ADMIN" || !active)) {
    return "You can't remove your own admin access or deactivate yourself.";
  }

  const clash = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
  if (clash) return "A user with that email already exists.";

  const passwordHash = newPassword ? await bcrypt.hash(newPassword, 10) : undefined;

  const found = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, include: { departments: true } });
    if (!before) return false;

    await tx.userDepartment.deleteMany({ where: { userId } });
    const after = await tx.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role,
        active,
        canSeeCosts: role === "MANAGER" ? canSeeCosts : role === "ADMIN",
        ...(passwordHash ? { passwordHash, failedLoginAttempts: 0, lockedUntil: null } : {}),
        departments:
          role === "OPERATOR" ? { create: departmentIds.map((departmentId) => ({ departmentId })) } : undefined,
      },
    });

    const { departments, ...beforeUser } = before;
    await writeAudit(tx, viewer.id, {
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      before: { ...beforeUser, departmentIds: departments.map((d) => d.departmentId).sort() },
      after: {
        ...after,
        departmentIds: role === "OPERATOR" ? [...departmentIds].sort() : [],
        ...(passwordHash ? { passwordReset: true } : {}),
      },
    });
    return true;
  });
  if (!found) return "User not found.";

  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
}

// Only a user with no recorded activity can be deleted outright; anyone who
// has touched records must be deactivated instead so history stays linked.
export async function deleteUser(userId: string) {
  const viewer = await requirePermission("admin");

  if (viewer.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { transactions: true, auditLogs: true, stoneEvents: true } } },
    });
    if (!user) throw new Error("User not found.");
    if (user._count.transactions > 0 || user._count.auditLogs > 0 || user._count.stoneEvents > 0) {
      throw new Error("This user has recorded activity — deactivate them instead of deleting.");
    }
    const { _count, ...before } = user;
    await tx.user.delete({ where: { id: userId } });
    await writeAudit(tx, viewer.id, { action: "DELETE", entity: "User", entityId: userId, before });
  });

  revalidatePath("/users");
}
