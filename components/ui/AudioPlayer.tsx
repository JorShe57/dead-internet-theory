"use client";
import { useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";
import { formatTime } from "@/lib/utils";
import { Pause, Play, Volume2, SkipBack, SkipForward } from "lucide-react";

type MediaArtwork = { src: string; sizes?: string; type?: string };
type Props = {
  src: string;
  title?: string;
  onEnd?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  mediaMeta?: {
    artist?: string;
    album?: string;
    artwork?: MediaArtwork[];
  };
};

export default function AudioPlayer({ src, title, onEnd, onPrev, onNext, mediaMeta }: Props) {
  const howlRef = useRef<Howl | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(true);

  // Load sound (Howler, HTML5)
  useEffect(() => {
    // Stop any other playing sounds to avoid double playback
    try { Howler.stop(); } catch {}
    howlRef.current?.unload();
    setProgress(0);
    setDuration(0);
    setLoading(true);
    setIsPlaying(false);
    const sound = new Howl({
      src: [src],
      html5: true,
      onend: () => { setIsPlaying(false); onEnd?.(); },
      onplay: () => { setIsPlaying(true); },
      onpause: () => { setIsPlaying(false); },
      onstop: () => { setIsPlaying(false); },
      onload: () => { setDuration(sound.duration()); setLoading(false); },
      onloaderror: () => setLoading(false),
      onplayerror: () => setLoading(false),
    });
    howlRef.current = sound;
    return () => { try { sound.unload(); } catch {} };
  }, [src, onEnd]);

  useEffect(() => { howlRef.current?.volume(volume); }, [volume]);

  // Progress ticker
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const s = howlRef.current;
      if (s && s.playing()) setProgress(s.seek() as number);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Media Session metadata + actions
  useEffect(() => {
    const nav: any = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (!nav || !("mediaSession" in nav)) return;
    try {
      const meta = new (window as any).MediaMetadata({
        title: title || "",
        artist: mediaMeta?.artist || "Dead Internet Theory",
        album: mediaMeta?.album || "Dead Internet Theory",
        artwork: mediaMeta?.artwork || [],
      });
      nav.mediaSession.metadata = meta;
      nav.mediaSession.setActionHandler("play", () => {
        const s = howlRef.current; if (!s) return; s.play(); setIsPlaying(true);
        if (nav.mediaSession) nav.mediaSession.playbackState = 'playing';
      });
      nav.mediaSession.setActionHandler("pause", () => {
        const s = howlRef.current; if (!s) return; s.pause(); setIsPlaying(false);
        if (nav.mediaSession) nav.mediaSession.playbackState = 'paused';
      });
      nav.mediaSession.setActionHandler("previoustrack", onPrev || null);
      nav.mediaSession.setActionHandler("nexttrack", onNext || null);
    } catch {}
  }, [title, mediaMeta?.artist, mediaMeta?.album, onPrev, onNext]);

  const toggle = () => {
    const s = howlRef.current; if (!s) return;
    if (s.playing()) {
      s.pause();
      try { (navigator as any)?.mediaSession && ((navigator as any).mediaSession.playbackState = 'paused'); } catch {}
    } else {
      try { Howler.stop(); } catch {}
      s.play();
      try { (navigator as any)?.mediaSession && ((navigator as any).mediaSession.playbackState = 'playing'); } catch {}
    }
  };

  const onScrub = (val: number) => { const s = howlRef.current; if (!s) return; s.seek(val); setProgress(val); };
  const onChangeVolume = (v: number) => { setVolume(v); howlRef.current?.volume(v); };

  return (
    <div className="relative w-full border border-accent/50 rounded p-4 bg-surface/10" aria-busy={loading}>
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-deep-charcoal/60 rounded">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric-green border-t-transparent" aria-label="Loading audio" />
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-accent truncate max-w-[70%]">
          {title ?? src}
        </div>
        <div className="flex items-center gap-2">
          {onPrev && (
            <button className="btn" onClick={onPrev} aria-label="Previous track">
              <SkipBack size={18} />
            </button>
          )}
          <button className="btn" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          {onNext && (
            <button className="btn" onClick={onNext} aria-label="Next track">
              <SkipForward size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums w-12 text-accent">{formatTime(progress)}</span>
        <input
          type="range"
          className="w-full"
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={progress}
          onChange={(e) => onScrub(Number(e.target.value))}
        />
        <span className="text-xs tabular-nums w-12 text-accent">{formatTime(duration)}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Volume2 size={16} className="text-accent" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onChangeVolume(Number(e.target.value))}
          className="w-40"
        />
      </div>
    </div>
  );
}
