"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSession } from "@/lib/auth";
import PostForm from "@/components/social/PostForm";
import PostFeed from "@/components/social/PostFeed";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import QRScanner from "@/components/ui/QRScanner";
import { fetchWithTimeoutRetry } from "@/lib/utils";
import { useToast } from "@/components/system/ToastProvider";
import Image from "next/image";
import Link from "next/link";

export default function SocialPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [special, setSpecial] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [specialCode, setSpecialCode] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const ok = await validateSession();
      if (!ok) router.replace("/");
      else setReady(true);
    })();
  }, [router]);

  const onQr = async (text: string) => {
    setScanMsg("Checking code...");
    try {
      const res = await fetchWithTimeoutRetry("/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qr: text }),
      });
      const data = await res.json();
      if (data.valid && data.type === "special") {
        setSpecial(true);
        setSpecialCode(data.code);
        setScanMsg("Care package unlocked ✦");
        toast({ title: "Care package unlocked", description: data.code, variant: "success" });
      } else if (data.valid) {
        setScanMsg("Valid code (album)");
      } else {
        setScanMsg("Invalid code");
      }
    } catch {
      setScanMsg("Error checking code");
    }
  };

  if (!ready) return <div className="text-accent">Verifying session...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="glitch text-2xl" data-text="SOCIAL WALL">SOCIAL WALL</h1>
        <div className="flex items-center gap-2">
          <Link href="/album" className="btn" aria-label="Back to album">← Back to Album</Link>
          <Link href="/chat" className="btn" aria-label="Chat with Dead Internet">Chat</Link>
          <QRScanner onResult={onQr} />
          {special && (
            <span className="text-accent text-xs">Care package: ON</span>
          )}
        </div>
      </div>
      {/* Image under title and above content */}
      <div className="relative w-full overflow-hidden rounded-lg border border-accent/30 bg-surface/10">
        <div className="relative w-full aspect-[16/9]">
          <Image
            src="/images/Screenshot%202025-09-05%20at%2012.13.25%E2%80%AFPM.png"
            alt="Social wall artwork"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      </div>
      {scanMsg && (
        <div className="text-xs text-accent" role="status" aria-live="polite">{scanMsg}</div>
      )}
      <ErrorBoundary area="PostForm">
        <PostForm specialUnlocked={special} specialCode={specialCode} />
      </ErrorBoundary>
      <ErrorBoundary area="PostFeed">
        <PostFeed />
      </ErrorBoundary>
    </div>
  );
}
