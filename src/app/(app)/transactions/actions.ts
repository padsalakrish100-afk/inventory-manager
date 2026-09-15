"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function createTransaction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const productId = String(formData.get("productId") ?? "");
  const type = String(formData.get("type") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const partyName = String(formData.get("party") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!productId) return "Choose a product.";
  if (type !== "IN" && type !== "OUT") return "Choose a transaction type.";
  if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be a positive number.";

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("Product not found.");

      const qty = Math.trunc(quantity);
      const newStock = type === "IN" ? product.stock + qty : product.stock - qty;

      if (newStock < 0) {
        throw new Error(
          `Not enough stock: only ${product.stock} ${product.unit} of ${product.name} available.`,
        );
      }

      let partyId: string | null = null;
      if (partyName) {
        const party = await tx.party.upsert({
          where: { name: partyName },
          update: {},
          create: { name: partyName },
        });
        partyId = party.id;
      }

      await tx.product.update({ where: { id: productId }, data: { stock: newStock } });
      await tx.transaction.create({
        data: {
          type,
          quantity: qty,
          partyId,
          reference,
          notes,
          productId,
          userId: session.user.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }

  revalidatePath("/transactions");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect("/transactions");
}
