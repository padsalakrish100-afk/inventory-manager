"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can manage users.");
  }
  return session;
}

export async function createUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "STAFF");

  if (!name || !email) return "Name and email are required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (role !== "ADMIN" && role !== "STAFF") return "Invalid role.";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "A user with that email already exists.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash, role } });

  revalidatePath("/users");
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin();

  if (session.user.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const transactionCount = await prisma.transaction.count({ where: { userId } });
  if (transactionCount > 0) {
    throw new Error("This user has recorded transactions and cannot be deleted.");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/users");
}
