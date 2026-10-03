"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export type ChangePasswordResult = { error?: string; success?: boolean };

export async function changePassword(
  _prevState: ChangePasswordResult | undefined,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) return { error: "Fill in both password fields." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "New password and confirmation don't match." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await writeAudit(tx, user.id, {
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      before: { password: "[previous]" },
      after: { password: "[changed by user]" },
    });
  });

  return { success: true };
}
