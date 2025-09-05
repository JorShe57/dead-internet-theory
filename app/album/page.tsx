"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validateSession } from "@/lib/auth";
import AudioPlayer from "@/components/ui/AudioPlayer";
import Link from "next/link";

const tracks: { title: string; file: string }[] = [
  { title: "Apples & Oranges (MIX V.1.1)", file: "/audio/Apples%20%26%20Oranges%20(MIX%20V.1.1).mp3" },
  { title: "COMPLX (MIX V1.3)", file: "/audio/COMPLX%20(MIX%20V1.3).mp3" },
  { title: "Crown vs Pedestal (MIX 3.0)", file: "/audio/Crown%20vs%20Pedestal%20(MIX%203.0).mp3" },
  { title: "Dead Internet - NEEDS VERSE (Mix V.03)", file: "/audio/Dead%20Internet%20-%20NEEDS%20VERSE%20(Mix%20V.03).mp3" },
  { title: "Devil Wears Resale (MIX V.05)", file: "/audio/Devil%20Wears%20Resale%20(MIX%20V.05).mp3" },
  { title: "Everything's Fine (MIX V0.5)", file: "/audio/Everything%27s%20Fine%20(MIX%20V0.5).mp3" },
  { title: "Ghosts & Amusement Parks (MIX V1.3)", file: "/audio/Ghosts%20%26%20Amusement%20Parks%20(MIX%20V1.3).mp3" },
  { title: "Hibernate (NEW Mix 2.1)", file: "/audio/Hibernate%20(NEW%20Mix%202.1).mp3" },
  { title: "Jawscercize (MIX V2.1)", file: "/audio/Jawscercize%20(MIX%20V2.1).mp3" },
  { title: "Loading Out (MIX V2.0)", file: "/audio/Loading%20Out%20(MIX%20V2.0).mp3" },
  { title: "Orwell (MIX V1.1)", file: "/audio/Orwell%20(MIX%20V1.1).mp3" },
  { title: "Pleasant Monsters & Mean Sprites (MIX V3.0)", file: "/audio/Pleasant%20Monsters%20%26%20Mean%20Sprites%20(MIX%20V3.0).mp3" },
  { title: "Sunken Living Room (MIX V3.5)", file: "/audio/Sunken%20Living%20Room%20(MIX%20V3.5).mp3" },
  { title: "Terrariums (MIX V1.3)", file: "/audio/Terrariums%20(MIX%20V1.3).mp3" },
  { title: "Trash Day (MIX V2.1)", file: "/audio/Trash%20Day%20(MIX%20V2.1).mp3" },
  { title: "Zeros (FINFINFIN MIX V3.0)", file: "/audio/Zeros%20(FINFINFIN%20MIX%20V3.0).mp3" },
];

export default function AlbumPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);

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
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="glitch text-2xl" data-text="ALBUM">ALBUM</h1>
        <div className="flex items-center gap-2">
          <Link href="/social" className="btn">Social Wall</Link>
          <Link href="/chat" className="btn" aria-label="Chat with Dead Internet">Chat</Link>
        </div>
      </div>

      {/* Hero video under title, above player */}
      <div className="relative w-full overflow-hidden rounded-lg border border-accent/30 bg-surface/10">
        <video
          src="/videos/DIT%20AL.mp4"
          playsInline
          autoPlay
          muted
          loop
          preload="metadata"
          className="w-full h-auto"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="text-sm opacity-80">Now Playing: <span className="text-accent font-medium">{currentTrack.title}</span></div>
          <AudioPlayer
            src={currentTrack.file}
            title={currentTrack.title}
            onEnd={() => setCurrent((i) => (i + 1) % tracks.length)}
            onPrev={() => setCurrent((i) => (i - 1 + tracks.length) % tracks.length)}
            onNext={() => setCurrent((i) => (i + 1) % tracks.length)}
            mediaMeta={{
              artist: "Dead Internet Theory",
              album: "Dead Internet Theory",
              artwork: [
                { src: "/images/IMG_8051.PNG", sizes: "512x512", type: "image/png" },
              ],
            }}
          />
        </div>
        <div className="space-y-2">
          <div className="text-accent">Tracks</div>
          <ul className="space-y-1">
            {tracks.map((t, i) => (
              <li key={t.file}>
                <button
                  className={`w-full text-left px-3 py-2 rounded border ${i === current ? "border-accent text-accent" : "border-accent/50 text-accent/80"}`}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}. {t.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
