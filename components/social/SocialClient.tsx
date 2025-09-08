"use client";
import { useState } from "react";
import PostForm from "@/components/social/PostForm";
import PostFeed from "@/components/social/PostFeed";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import QRScanner from "@/components/ui/QRScanner";
import { fetchWithTimeoutRetry } from "@/lib/utils";
import { useToast } from "@/components/system/ToastProvider";
import Image from "next/image";
import AppHeader from "@/components/ui/AppHeader";

/**
 * Client-side component for the social wall functionality
 * Handles QR scanning, special codes, and post interactions
 */
export default function SocialClient() {
  const [special, setSpecial] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [specialCode, setSpecialCode] = useState<string | undefined>(undefined);
  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
      <AppHeader
        title="SOCIAL WALL"
        menuLinks={[
          { label: "← Back to Album", href: "/album", ariaLabel: "Back to album" },
          { label: "Chat", href: "/chat", ariaLabel: "Chat with Dead Internet" },
        ]}
        rightChildren={
          <div className="flex items-center gap-2">
            <QRScanner onResult={onQr} />
            {special && <span className="text-accent text-xs">Care package: ON</span>}
          </div>
        }
      />
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
