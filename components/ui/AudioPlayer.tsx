"use client";
import { useEffect, useRef, useState } from "react";
import { Howl } from "howler";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(true);
  const [useNative, setUseNative] = useState(false);
  const [showVol, setShowVol] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowVol(window.innerWidth >= 768); // show by default on md+
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const isiOS = /iP(hone|od|ad)/.test(navigator.userAgent);
      setUseNative(isiOS);
    }
  }, []);

  // Load sound
  useEffect(() => {
    setProgress(0);
    setDuration(0);
    setLoading(true);
    if (useNative) {
      const el = audioRef.current;
      if (!el) return;
      el.src = src;
      el.load();
      const onLoaded = () => { setDuration(el.duration || 0); setLoading(false); };
      const onEnded = () => { setIsPlaying(false); onEnd?.(); };
      const onTime = () => setProgress(el.currentTime || 0);
      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('ended', onEnded);
      el.addEventListener('timeupdate', onTime);
      return () => {
        el.pause();
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('timeupdate', onTime);
      };
    } else {
      howlRef.current?.unload();
      const sound = new Howl({
        src: [src],
        html5: true,
        onend: () => { setIsPlaying(false); onEnd?.(); },
        onload: () => { setDuration(sound.duration()); setLoading(false); },
        onloaderror: () => setLoading(false),
      });
      howlRef.current = sound;
      return () => { try { sound.unload(); } catch {} };
    }
  }, [src, onEnd, useNative]);

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume);
    }
  }, [volume]);

  // Ticker
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (useNative) {
        const el = audioRef.current;
        if (el && !el.paused) setProgress(el.currentTime || 0);
      } else {
        const s = howlRef.current;
        if (s && s.playing()) setProgress(s.seek() as number);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [useNative]);

  // Media Session API for lockscreen controls / background playback metadata
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
        if (useNative) { const el = audioRef.current; if (!el) return; el.play().catch(() => {}); setIsPlaying(true); }
        else { const s = howlRef.current; if (!s) return; s.play(); setIsPlaying(true); }
        if (nav.mediaSession) nav.mediaSession.playbackState = "playing";
      });
      nav.mediaSession.setActionHandler("pause", () => {
        if (useNative) { const el = audioRef.current; if (!el) return; el.pause(); setIsPlaying(false); }
        else { const s = howlRef.current; if (!s) return; s.pause(); setIsPlaying(false); }
        if (nav.mediaSession) nav.mediaSession.playbackState = "paused";
      });
      nav.mediaSession.setActionHandler("previoustrack", onPrev || null);
      nav.mediaSession.setActionHandler("nexttrack", onNext || null);
      nav.mediaSession.setActionHandler("seekto", (d: any) => { if (d?.seekTime !== undefined) onScrub(Number(d.seekTime)); });
      nav.mediaSession.setActionHandler("seekbackward", () => onScrub(Math.max(0, progress - 10)));
      nav.mediaSession.setActionHandler("seekforward", () => onScrub(Math.min(duration, progress + 10)));
    } catch {}
  }, [title, mediaMeta?.artist, mediaMeta?.album, onPrev, onNext, useNative, progress, duration]);

  const toggle = () => {
    const s = howlRef.current;
    if (!s) return;
    if (s.playing()) {
      s.pause();
      setIsPlaying(false);
      try { (navigator as any)?.mediaSession && ((navigator as any).mediaSession.playbackState = "paused"); } catch {}
    } else {
      s.play();
      setIsPlaying(true);
      try { (navigator as any)?.mediaSession && ((navigator as any).mediaSession.playbackState = "playing"); } catch {}
    }
  };

  const onScrub = (val: number) => {
    if (useNative) { const el = audioRef.current; if (!el) return; el.currentTime = val; setProgress(val); }
    else { const s = howlRef.current; if (!s) return; s.seek(val); setProgress(val); }
  };

  const onChangeVolume = (v: number) => {
    setVolume(v);
    if (useNative) { if (audioRef.current) audioRef.current.volume = v; }
    else howlRef.current?.volume(v);
  };

  return (
    <div className="relative w-full border border-accent/50 rounded p-3 sm:p-4 bg-surface/10" aria-busy={loading}>
      {useNative && <audio ref={audioRef} className="hidden" />}
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
        <button className="btn" onClick={() => setShowVol((v) => !v)} aria-label="Toggle volume">
          <Volume2 size={16} className="text-accent" />
        </button>
        {showVol && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            className="w-40"
          />
        )}
      </div>
    </div>
  );
}
