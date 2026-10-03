"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { IScannerControls } from "@zxing/browser";
import { parseScannedCode } from "@/lib/stone/scan";

type CameraState = "starting" | "running" | "denied" | "unavailable";

// Phone camera scanner (QR and Code128). Scanning a stone opens its page;
// typing the number works too, for when the camera can't focus.
export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [state, setState] = useState<CameraState>("starting");
  // Bumped by "Start camera" to re-run the camera effect after a failure.
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState("");

  function open(raw: string) {
    const code = parseScannedCode(raw);
    if (!code || handledRef.current) return;
    handledRef.current = true;
    controlsRef.current?.stop();
    if (navigator.vibrate) navigator.vibrate(60);
    router.push(`/s/${encodeURIComponent(code)}`);
  }

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          setState("unavailable");
          return;
        }
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current!,
          (result) => {
            if (result) open(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState("running");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // `open` only uses refs and the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-900 sm:aspect-video">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state === "running" && (
          <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        )}
        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-200">
            {state === "starting" && <p>Starting camera…</p>}
            {state === "denied" && <p>Camera permission was blocked. Allow camera access for this site, then try again.</p>}
            {state === "unavailable" && <p>No camera available here. Type the stone number below instead.</p>}
            {(state === "denied" || state === "unavailable") && (
              <button
                type="button"
                onClick={() => {
                  setState("starting");
                  setAttempt((n) => n + 1);
                }}
                className="min-h-12 rounded-lg bg-white px-5 py-3 text-base font-medium text-zinc-900"
              >
                Start camera
              </button>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handledRef.current = false;
          open(manual);
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type / scan a stone number"
          autoComplete="off"
          autoCapitalize="characters"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 px-4 text-base focus:border-zinc-500 focus:outline-none"
        />
        <button type="submit" className="min-h-12 rounded-lg bg-[var(--accent)] px-5 text-base font-medium text-white">
          Open
        </button>
      </form>
    </div>
  );
}
