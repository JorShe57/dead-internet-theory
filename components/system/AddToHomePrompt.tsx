"use client";
import { useEffect, useState } from "react";

const DISMISS_KEY = "dit_a2hs_dismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

function inStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-ignore
  if (window.navigator && (window.navigator as any).standalone) return true;
  // PWA display-mode
  return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
}

export default function AddToHomePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS()) return; // Focus iOS where this matters most
    if (inStandalone()) return;
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === "1") return;
    } catch {}
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-50 border border-accent/50 rounded bg-deep-charcoal/90 backdrop-blur p-3 sm:p-4 text-sm text-foreground">
      <div className="font-medium text-electric-green mb-1">Install for better background audio</div>
      <div className="opacity-80">
        On iPhone, tap the Share icon, then “Add to Home Screen” for smoother background playback and lock screen controls.
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="btn"
          onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
            setShow(false);
          }}
          aria-label="Dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

