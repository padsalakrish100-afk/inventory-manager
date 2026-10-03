"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { addPacket, allocatePurchaseCost, deletePacket, lotPacket, updateKp, voidRoughPurchase } from "../actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function PacketForm({ purchaseId }: { purchaseId: string }) {
  const [error, onSubmit, pending] = useFormAction(addPacket.bind(null, purchaseId), undefined, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-7 sm:items-end">
      <label className="text-xs font-medium text-zinc-500">
        Size
        <input name="sizeRange" placeholder="e.g. 2-3 ct" className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Quality
        <input name="quality" placeholder="e.g. Clivage" className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Model
        <input name="model" placeholder="e.g. Makeable" className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Carats
        <input name="carats" inputMode="decimal" required className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Pieces
        <input name="pieces" inputMode="numeric" required className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Notes
        <input name="notes" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 sm:col-span-1"
      >
        {pending ? "Adding..." : "Add packet"}
      </button>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-7">{error}</p>}
    </form>
  );
}

export function LotPacketForm({ packetId, pieces }: { packetId: string; pieces: number }) {
  const [error, onSubmit, pending] = useFormAction(lotPacket, undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="packetId" value={packetId} />
      <input
        name="stoneCount"
        inputMode="numeric"
        defaultValue={pieces}
        aria-label="Number of stones"
        className="min-h-10 w-20 rounded-md border border-zinc-300 px-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 whitespace-nowrap rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Lot it"}
      </button>
      {error && <span className="w-full text-right text-xs text-red-600">{error}</span>}
    </form>
  );
}

export function DeletePacketButton({ packetId }: { packetId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this packet?")) return;
        startTransition(async () => {
          const r = await deletePacket(packetId);
          if (r.error) alert(r.error);
        });
      }}
      className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
    >
      Delete
    </button>
  );
}

export function AllocateButton({ purchaseId }: { purchaseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await allocatePurchaseCost(purchaseId);
            setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: r.info ?? "Done." });
          })
        }
        className="min-h-11 w-fit rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Allocating..." : "Allocate cost to packets & stones"}
      </button>
      {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}

export function KpForm({ purchaseId, kpCertNo }: { purchaseId: string; kpCertNo: string | null }) {
  const [message, onSubmit, pending] = useFormAction(updateKp.bind(null, purchaseId), undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-zinc-500">
        KP certificate no.
        <input name="kpCertNo" defaultValue={kpCertNo ?? ""} className="mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm" />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Add file
        <input name="kpFiles" type="file" accept="application/pdf,image/*" multiple className="mt-1 block text-sm" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save KP"}
      </button>
      {message && <span className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</span>}
    </form>
  );
}

export function VoidPurchaseButton({ purchaseId }: { purchaseId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancel this purchase? Only possible while nothing from it is in production.")) return;
        startTransition(async () => {
          const r = await voidRoughPurchase(purchaseId);
          if (r.error) alert(r.error);
        });
      }}
      className="min-h-10 rounded-md border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
    >
      Cancel purchase
    </button>
  );
}
