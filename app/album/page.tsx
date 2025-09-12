"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSession } from "@/lib/auth";
import { usePlayer } from "@/components/system/PlayerProvider";
import AppHeader from "@/components/ui/AppHeader";

const tracks: { title: string; file: string }[] = [
  { title: "Crown vs Pedestal", file: "/audio/1%20-%20Crown%20vs%20Pedestal.mp3" },
  { title: "COMPLX", file: "/audio/2%20-%20COMPLX%20(MP3).mp3" },
  { title: "Devil Wears Resale", file: "/audio/3%20-%20Devil%20Wears%20Resale%20(MIX%20V2).mp3" },
  { title: "Trash Day", file: "/audio/4%20-%20Trash%20Day%20(MP3).mp3" },
  { title: "Terrariums", file: "/audio/5%20-%20Terrerium%20(MP3).mp3" },
  { title: "Sunken Living Room", file: "/audio/7%20-%20Sunken%20Living%20Room%20(MIX%20V3.5).mp3" },
  { title: "Pleasant Monsters & Mean Sprites", file: "/audio/6%20-%20Pleasant%20Monsters%20%26%20Mean%20Sprites%20(MP3).mp3" },
  { title: "Ghosts & Amusement Parks", file: "/audio/8%20-%20Ghosts%20%26%20Amusement%20Parks%20(MIX%20V2).mp3" },
  { title: "Orwell", file: "/audio/9%20-%20Orwell%20(MP3).mp3" },
  { title: "Everything's Fine", file: "/audio/10%20-%20Everything_s%20Fine%20(MIX%20V2).mp3" },
  { title: "Apples & Oranges", file: "/audio/11%20-%20Apples%20%26%20Oranges.mp3" },
  { title: "Jawscercize", file: "/audio/12%20-%20Jawscercize%20(MP3).mp3" },
  { title: "Zeros", file: "/audio/13%20-%20Zeros%20(MP3).mp3" },
  { title: "Dead Internet - NEEDS VERSE", file: "/audio/14%20-%20Dead%20Internet%20(Mix%20V2.0).mp3" },
  { title: "Loading Out", file: "/audio/15%20-%20Loading%20Out%20(MIX%20V2.0).mp3" },
  { title: "Hibernate", file: "/audio/16%20-%20Hibernate%20(MP3).mp3" },
];

export default function AlbumPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const { hasQueue, setQueue, playIndex } = usePlayer();

  useEffect(() => {
    (async () => {
      const ok = await validateSession();
      if (!ok) router.replace("/");
      else setReady(true);
    })();
  }, [router]);

  const currentTrack = useMemo(() => tracks[current], [current]);

  if (!ready) return <div className="text-accent">Verifying session...</div>;
  if (tracks.length === 0)
    return (
      <div className="border border-accent/50 rounded p-6 bg-surface/10 text-center">
        <div className="text-electric-green mb-2">No tracks available.</div>
        <div className="text-sm opacity-80">Check back soon for new transmissions.</div>
      </div>
    );

  return (
    <div className="space-y-3">
      <AppHeader
        title="ALBUM"
        menuLinks={[
          { label: "Social Wall", href: "/social" },
          { label: "Chat", href: "/chat", ariaLabel: "Chat with Dead Internet" },
        ]}
      />

      {/* Hero video under title, above player */}
      <div className="relative w-full overflow-hidden rounded-lg border border-accent/30 bg-surface/10 h-[28vh] sm:h-auto">
        <video
          src="/videos/DIT%20AL.mp4"
          playsInline
          autoPlay
          muted
          loop
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* Full track list; constrained height to avoid page overflow */}
        <div className="md:col-span-2 space-y-2 max-h-[42vh] md:max-h-[60vh] overflow-y-auto pr-1">
          <div className="text-accent">Tracks</div>
          <ul className="space-y-1">
            {tracks.map((t, i) => (
              <li key={t.file}>
                <button
                  className={`w-full text-left px-3 py-2 rounded border ${i === current ? "border-accent text-accent" : "border-accent/50 text-accent/80"}`}
                  onClick={() => {
                    setCurrent(i);
                    // Initialize the shared queue if not set, or just jump to index
                    if (!hasQueue) setQueue(tracks, i);
                    else playIndex(i);
                  }}
                >
                  {i + 1}. {t.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-accent/80">
            Player lives at the bottom and keeps playing across pages.
          </div>
          <button
            className="btn"
            onClick={() => {
              if (!hasQueue) setQueue(tracks, current);
            }}
          >
            {hasQueue ? "Now Playing in Mini Player" : "Start Playing in Mini Player"}
          </button>
        </div>
      </div>
    </div>
  );
}
