"use client";

import { useState, useTransition } from "react";
import { checkWithGia, markInStock, sendToLab, uploadCertificate } from "../actions";
import { CERT_LABS } from "@/lib/stone/certificates";
import type { GiaReport } from "@/lib/gia";

const BTN =
  "min-h-12 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60";
const PRIMARY =
  "min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-medium text-white hover:brightness-110 disabled:opacity-60";
const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

// Send to lab / mark in stock, depending on where the stone is now.
export function StatusControls({
  polishedId,
  status,
  defaultLab,
}: {
  polishedId: string;
  status: string;
  defaultLab: string | null;
}) {
  const [open, setOpen] = useState<"lab" | "stock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canLab = status === "POLISHED" || status === "IN_STOCK";
  const canStock = status === "POLISHED" || status === "AT_LAB";
  if (!canLab && !canStock) return null;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else setOpen(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canLab && (
          <button type="button" className={BTN} onClick={() => setOpen(open === "lab" ? null : "lab")}>
            Send to lab
          </button>
        )}
        {canStock && (
          <button type="button" className={BTN} onClick={() => setOpen(open === "stock" ? null : "stock")}>
            {status === "AT_LAB" ? "Back from lab — in stock" : "Mark in stock"}
          </button>
        )}
      </div>
      {open === "lab" && (
        <form
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => sendToLab(polishedId, String(f.get("lab") ?? ""), String(f.get("note") ?? "")));
          }}
        >
          <label className="text-sm font-medium text-zinc-700">
            Lab
            <select name="lab" defaultValue={defaultLab ?? "GIA"} className={INPUT}>
              {CERT_LABS.filter((l) => l.value !== "OTHER").map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Note
            <input name="note" placeholder="Optional — e.g. shipped via Malca-Amit" className={INPUT} />
          </label>
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Saving..." : "Send to lab"}
          </button>
        </form>
      )}
      {open === "stock" && (
        <form
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              markInStock(polishedId, {
                note: String(f.get("note") ?? ""),
                fee: String(f.get("fee") ?? ""),
                currency: String(f.get("currency") ?? "USD"),
              }),
            );
          }}
        >
          {status === "AT_LAB" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-zinc-700">
                Lab fee
                <input name="fee" type="number" min={0} step="0.01" placeholder="Optional" className={INPUT} />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Currency
                <select name="currency" defaultValue="USD" className={INPUT}>
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </label>
              <p className="col-span-2 text-xs text-zinc-500">The fee goes on the stone&apos;s cost ledger as certification.</p>
            </div>
          )}
          <label className="text-sm font-medium text-zinc-700">
            Note
            <input name="note" placeholder="Optional" className={INPUT} />
          </label>
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Saving..." : "Put in stock (office safe)"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CertificateUpload({ polishedId }: { polishedId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setError(null);
        startTransition(async () => {
          const r = await uploadCertificate(polishedId, f);
          if (r.error) setError(r.error);
          else form.reset();
        });
      }}
    >
      <input name="certificate" type="file" accept="application/pdf,image/*" required className="text-sm" />
      <button type="submit" disabled={pending} className={BTN}>
        {pending ? "Uploading..." : "Upload certificate"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

const GIA_FIELDS: [keyof GiaReport, string][] = [
  ["reportDate", "Date"],
  ["shape", "Shape"],
  ["carat", "Carat"],
  ["color", "Color"],
  ["clarity", "Clarity"],
  ["cut", "Cut"],
  ["polish", "Polish"],
  ["symmetry", "Symmetry"],
  ["fluorescence", "Fluorescence"],
  ["measurements", "Measurements"],
];

// Looks the report up on GIA and shows it next to ours — nothing is overwritten.
export function GiaCheckButton({ polishedId }: { polishedId: string }) {
  const [result, setResult] = useState<{ error?: string; report?: GiaReport | null } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className={BTN}
        onClick={() => startTransition(async () => setResult(await checkWithGia(polishedId)))}
      >
        {pending ? "Checking..." : "Check with GIA"}
      </button>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result && !result.error && !result.report && <p className="text-sm text-red-600">GIA has no report with that number.</p>}
      {result?.report && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-zinc-50 p-3 text-sm">
          {GIA_FIELDS.map(([k, label]) => (
            <div key={k} className="contents">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-900">{result.report![k] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
