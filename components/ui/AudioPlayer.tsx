"use client";
import { useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";
import { cn, formatTime } from "@/lib/utils";
import { Pause, Play, Volume2, SkipBack, SkipForward } from "lucide-react";
import { getSessionToken } from "@/lib/auth";
import { 
  mediaSessionLogger, 
  isIOSSafari, 
  updatePlaybackState, 
  updatePositionState, 
  updateMetadata 
} from "@/lib/mediaSessionLogger";

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
  /**
   * When the `src` changes, automatically start playback once loaded.
   * This enables seamless play-through between tracks.
   */
  autoplayOnSrcChange?: boolean;
  /**
   * Visual variant for container background.
   */
  variant?: "default" | "solid";
  /**
   * Optional additional class names for the root container.
   */
  className?: string;
};

export default function AudioPlayer({ src, title, onEnd, onPrev, onNext, mediaMeta, autoplayOnSrcChange = true, variant = "default", className }: Props) {
  const howlRef = useRef<Howl | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef<string | null>(null); // track_key of current started src
  const playIdRef = useRef<string | null>(null);

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
      onplay: async () => {
        setIsPlaying(true);
        // Update MediaSession playback state
        updatePlaybackState('playing');
        mediaSessionLogger.log('play', { src });
        // fire start only once per new source
        if (startedRef.current !== src) {
          startedRef.current = src;
          try {
            const token = getSessionToken();
            const idempotency = `${src}:${Date.now().toString(36)}`;
            const res = await fetch("/api/analytics/track", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ event: "start", track_key: src, idempotency_key: idempotency }),
              cache: "no-store",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.play_id) playIdRef.current = String(data.play_id);
          } catch { /* ignore analytics errors */ }
        }
      },
      onpause: () => {
        setIsPlaying(false);
        updatePlaybackState('paused');
        mediaSessionLogger.log('pause', { src });
      },
      onstop: () => {
        setIsPlaying(false);
        updatePlaybackState('paused');
        mediaSessionLogger.log('stop', { src });
      },
      onload: () => {
        const dur = sound.duration();
        setDuration(dur);
        setLoading(false);
        // Update position state for iOS lock screen
        updatePositionState(0, dur);
        // Auto-start playback on new track load when enabled
        if (autoplayOnSrcChange) {
          try {
            sound.play();
            // Notify MediaSession that we're playing (critical for lock screen autoplay)
            updatePlaybackState('playing');
          } catch {}
        }
      },
      onloaderror: () => setLoading(false),
      onplayerror: () => setLoading(false),
    });
    howlRef.current = sound;
    return () => { try { sound.unload(); } catch {} };
  }, [src, onEnd, autoplayOnSrcChange]);

  useEffect(() => { howlRef.current?.volume(volume); }, [volume]);

  // Progress ticker with position state updates for iOS
  useEffect(() => {
    let raf: number;
    let lastPositionUpdate = 0;
    const tick = () => {
      const s = howlRef.current;
      if (s && s.playing()) {
        const pos = s.seek() as number;
        setProgress(pos);
        // Update position state every 1 second for iOS lock screen
        const now = Date.now();
        if (now - lastPositionUpdate > 1000) {
          updatePositionState(pos, duration);
          lastPositionUpdate = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  // Media Session metadata + actions
  useEffect(() => {
    const nav: any = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (!nav || !("mediaSession" in nav)) return;
    
    const iOS = isIOSSafari();
    
    try {
      // Update metadata using helper function
      updateMetadata(
        title || "",
        mediaMeta?.artist || "Dead Internet",
        mediaMeta?.album || "Dead Internet",
        mediaMeta?.artwork || []
      );
      
      // CRITICAL: Play handler must be synchronous for iOS
      nav.mediaSession.setActionHandler("play", () => {
        mediaSessionLogger.log('play');
        const s = howlRef.current;
        if (!s) return;
        
        // Immediate synchronous play() call - critical for iOS
        try {
          s.play();
          setIsPlaying(true);
          updatePlaybackState('playing');
        } catch (err) {
          console.error('[AudioPlayer] Play failed:', err);
        }
      });
      
      nav.mediaSession.setActionHandler("pause", () => {
        mediaSessionLogger.log('pause');
        const s = howlRef.current;
        if (!s) return;
        s.pause();
        setIsPlaying(false);
        updatePlaybackState('paused');
      });
      
      // CRITICAL: Previous track handler for iOS
      // Must maintain audio session by pausing (not stopping) before track change
      nav.mediaSession.setActionHandler("previoustrack", onPrev ? () => {
        mediaSessionLogger.log('previoustrack');
        const s = howlRef.current;
        
        if (iOS && s) {
          // On iOS, pause (don't stop) to maintain audio session
          if (s.playing()) {
            s.pause();
          }
          // Keep playback state as "playing" to signal intent to continue
          updatePlaybackState('playing');
        }
        
        // Trigger prev callback - this will update state and load new track
        onPrev();
      } : null);
      
      // CRITICAL: Next track handler for iOS
      nav.mediaSession.setActionHandler("nexttrack", onNext ? () => {
        mediaSessionLogger.log('nexttrack');
        const s = howlRef.current;
        
        if (iOS && s) {
          // On iOS, pause (don't stop) to maintain audio session
          if (s.playing()) {
            s.pause();
          }
          // Keep playback state as "playing" to signal intent to continue
          updatePlaybackState('playing');
        }
        
        // Trigger next callback - this will update state and load new track
        onNext();
      } : null);
      
      // Add seek handlers for iOS - map to track navigation
      if (iOS) {
        // Seek backward = previous track
        nav.mediaSession.setActionHandler("seekbackward", onPrev ? () => {
          mediaSessionLogger.log('seekbackward');
          const s = howlRef.current;
          if (s && s.playing()) {
            s.pause();
          }
          updatePlaybackState('playing');
          onPrev();
        } : null);
        
        // Seek forward = next track
        nav.mediaSession.setActionHandler("seekforward", onNext ? () => {
          mediaSessionLogger.log('seekforward');
          const s = howlRef.current;
          if (s && s.playing()) {
            s.pause();
          }
          updatePlaybackState('playing');
          onNext();
        } : null);
        
        // Seekto for scrubbing timeline (if iOS supports it)
        nav.mediaSession.setActionHandler("seekto", (details: any) => {
          mediaSessionLogger.log('seekto', details);
          const s = howlRef.current;
          if (!s || !details?.seekTime) return;
          const newPos = Math.max(0, Math.min(details.seekTime, duration));
          s.seek(newPos);
          setProgress(newPos);
          updatePositionState(newPos, duration);
        });
      }
    } catch (err) {
      console.error('[AudioPlayer] MediaSession setup failed:', err);
    }
  }, [title, mediaMeta?.artist, mediaMeta?.album, mediaMeta?.artwork, onPrev, onNext, duration]);

  const toggle = () => {
    const s = howlRef.current; if (!s) return;
    if (s.playing()) {
      s.pause();
      updatePlaybackState('paused');
    } else {
      try { Howler.stop(); } catch {}
      s.play();
      updatePlaybackState('playing');
    }
  };

  const onScrub = (val: number) => {
    const s = howlRef.current;
    if (!s) return;
    s.seek(val);
    setProgress(val);
    updatePositionState(val, duration);
  };
  const onChangeVolume = (v: number) => { setVolume(v); howlRef.current?.volume(v); };

  // Best-effort end ping when track finishes (handled in onend) or component unmounts
  useEffect(() => {
    return () => {
      const playId = playIdRef.current;
      if (!playId) return;
      try {
        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "end", play_id: playId, position_ms: Math.floor(progress * 1000) }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
      playIdRef.current = null;
    };
  }, [progress]);

  return (
    <div
      className={cn(
        "relative w-full rounded p-4",
        variant === "solid" ? "bg-deep-charcoal border border-accent" : "border border-accent/50 bg-surface/10",
        className
      )}
      aria-busy={loading}
    >
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
