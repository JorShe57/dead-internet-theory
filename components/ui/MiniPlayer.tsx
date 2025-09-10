"use client";
import AudioPlayer from "@/components/ui/AudioPlayer";
import { usePlayer } from "@/components/system/PlayerProvider";
import { useEffect, useState } from "react";
import { Music, X } from "lucide-react";

const STORAGE_KEY = "dit_player_open";

export default function MiniPlayer() {
  const { current, next, prev, hasQueue } = usePlayer();
  const [open, setOpen] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "0") setOpen(false);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? "1" : "0"); } catch {}
  }, [open]);

  if (!hasQueue || !current) return null;
  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        className="fixed bottom-4 right-4 z-[10001] btn inline-flex items-center gap-2 bg-electric-green text-deep-charcoal border-electric-green"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide player" : "Show player"}
        aria-expanded={open}
      >
        {open ? <X size={16} /> : <Music size={16} />} {open ? "Hide" : "Play"}
      </button>

      {/* Drawer container: mobile bottom bar, desktop right sidebar */}
      <div
        className={
          "fixed z-[10000] bg-deep-charcoal shadow-xl border-t border-accent md:border-t-0 md:border-l md:top-0 md:right-0 md:bottom-0 md:w-[26rem] " +
          "inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)] " +
          (open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full") +
          " transition-transform duration-300 ease-in-out"
        }
      >
        <div className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-accent text-sm">Now Playing</div>
            <button className="btn" onClick={() => setOpen(false)} aria-label="Close player">
              <X size={16} />
            </button>
          </div>
          <AudioPlayer
            src={current.file}
            title={current.title}
            onEnd={next}
            onPrev={prev}
            onNext={next}
            mediaMeta={{
              artist: "Dead Internet Theory",
              album: "Dead Internet Theory",
              artwork: [{ src: "/images/IMG_8051.PNG", sizes: "512x512", type: "image/png" }],
            }}
            autoplayOnSrcChange
            variant="solid"
          />
        </div>
      </div>
    </>
  );
}
