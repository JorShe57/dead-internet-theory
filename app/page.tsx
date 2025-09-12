"use client";
import { useEffect, useRef, useState } from "react";
import GlitchText from "@/components/ui/GlitchText";
import Image from "next/image";
import { exchangeCodeForSession, validateSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useToast } from "@/components/system/ToastProvider";
import GuardianChat from "@/components/ui/GuardianChat";

export default function Home() {
  const [code, setCode] = useState("");
  const [showGuardian, setShowGuardian] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { online } = useNetworkStatus();
  const { toast } = useToast();
  const errRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // auto-redirect if already valid session
    (async () => {
      const ok = await validateSession();
      if (ok) router.replace("/album");
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (loading) return;
    
    // Validate code is not empty
    if (!code.trim()) {
      setError("Please enter an access code");
      toast({ title: "Error", description: "Please enter an access code", variant: "error" });
      return;
    }
    
    // Check if online (guard for SSR)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You are currently offline. Please check your connection and try again.");
      toast({ title: "Offline", description: "Please check your connection and try again", variant: "error" });
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await exchangeCodeForSession(code.trim());
      toast({ title: "Access granted", description: "Welcome in.", variant: "success" });
      router.replace("/album");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid code";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error && errRef.current) {
      errRef.current.focus();
    }
  }, [error]);

  // Try to autoplay video; fall back to muted if blocked
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlayWithSound = async () => {
      // Video has no audio track, but keep this resilient
      v.muted = true;
      v.autoplay = true;
      try {
        await v.play();
      } catch {
        // Fallback: ensure muted and try again
        v.muted = true;
        try {
          await v.play();
        } catch {/* ignore */}
      }
    };
    tryPlayWithSound();
  }, []);

  return (
    <div className="relative min-h-[100dvh] text-bright-white bg-[#000000]">
      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl text-center rounded-xl border border-electric-green/20 bg-deep-charcoal/40 backdrop-blur-md p-6 shadow-xl space-y-5">
          <GlitchText text="DEAD INTERNET" className="text-3xl sm:text-5xl text-electric-green" />

          {/* Video between title and subheading */
          }
          <div className="relative w-full overflow-hidden rounded-lg border border-electric-green/20">
            <video
              ref={videoRef}
              src="/videos/0905.mp4"
              preload="auto"
              playsInline
              autoPlay
              muted
              loop
              // Prevent PiP or other OS-level UI where supported
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
              className="w-full h-auto"
            />
          </div>

          <p className="text-electric-green/80">Enter access code to unlock the album.</p>
          {!online && (
            <div className="text-sm text-digital-blue">Offline — checks will resume when back online.</div>
          )}
          <form onSubmit={submit} className="flex gap-2 justify-center">
            <input
              className="w-full bg-stone-gray text-bright-white placeholder:text-neutral-tan/80 border border-electric-green/30 rounded px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-green focus-visible:border-electric-green"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              aria-label="Access code"
            />
            <button
              className="inline-flex items-center justify-center px-4 py-2 rounded border border-electric-green bg-electric-green text-deep-charcoal font-medium transition hover:brightness-110 hover:shadow-[0_0_12px_var(--color-electric-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-green disabled:opacity-70"
              disabled={loading || !online}
            >
              {loading ? (
                <span className="inline-flex items-center">
                  Checking...
                  <span className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-electric-green border-t-transparent" />
                </span>
              ) : (
                "Enter"
              )}
            </button>
          </form>
          {error && (
            <div
              ref={errRef}
              tabIndex={-1}
              className="error-message text-sm"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}
          {process.env.NODE_ENV !== 'production' && process.env.SHOW_ACCESS_HINT === 'true' && (
            <div className="text-xs text-electric-green">Hint: try [ACCESS_CODE_PLACEHOLDER]</div>
          )}

          {/* Image should be visible before optional helper chat */}
          <div className="w-full max-w-3xl mx-auto">
            <div className="relative w-full aspect-[4/3] mt-4">
              <Image
                src="/images/IMG_8051.PNG"
                alt="Artwork"
                fill
                className="object-contain rounded-lg"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          </div>

          {/* Collapsible Password Guardian chat (collapsed by default) */}
          <div className="mt-4 text-left">
            <button
              type="button"
              className="w-full flex items-center justify-between rounded border border-electric-green/40 bg-deep-charcoal/40 px-3 py-2 hover:border-electric-green transition"
              aria-expanded={showGuardian}
              aria-controls="password-guardian-panel"
              onClick={() => setShowGuardian((s) => !s)}
            >
              <span className="text-electric-green">Need a hint? Ask the Password Guardian</span>
              <span className={`transition-transform ${showGuardian ? "rotate-180" : "rotate-0"}`}>▾</span>
            </button>
            {showGuardian && (
              <div id="password-guardian-panel" className="mt-2">
                <GuardianChat />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
