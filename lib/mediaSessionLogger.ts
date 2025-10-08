/**
 * MediaSession Debug Logger
 * 
 * Provides development and production logging for MediaSession API events
 * to help debug iOS Safari lock screen audio issues.
 */

const isDev = process.env.NODE_ENV === 'development';

type MediaSessionEvent = 
  | 'play'
  | 'pause'
  | 'stop'
  | 'seekbackward'
  | 'seekforward'
  | 'seekto'
  | 'previoustrack'
  | 'nexttrack'
  | 'metadata_update'
  | 'position_update'
  | 'state_change';

interface LogEntry {
  timestamp: number;
  event: MediaSessionEvent;
  data?: any;
}

class MediaSessionLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  
  /**
   * Log a MediaSession event
   */
  log(event: MediaSessionEvent, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      event,
      data,
    };
    
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    if (isDev) {
      console.log(`[MediaSession] ${event}`, data || '');
    }
  }
  
  /**
   * Get recent logs for debugging
   */
  getLogs(count = 20): LogEntry[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
  }
  
  /**
   * Export logs as JSON for support tickets
   */
  export(): string {
    return JSON.stringify({
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      logs: this.logs,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

export const mediaSessionLogger = new MediaSessionLogger();

/**
 * Detect if running on iOS Safari
 */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Check if MediaSession API is available
 */
export function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * Safely update MediaSession playback state
 */
export function updatePlaybackState(state: 'none' | 'paused' | 'playing') {
  if (!hasMediaSession()) return;
  
  try {
    (navigator as any).mediaSession.playbackState = state;
    mediaSessionLogger.log('state_change', { state });
  } catch (err) {
    if (isDev) {
      console.warn('[MediaSession] Failed to update playback state:', err);
    }
  }
}

/**
 * Safely update MediaSession position state
 */
export function updatePositionState(position: number, duration: number, playbackRate = 1.0) {
  if (!hasMediaSession()) return;
  
  try {
    const nav = navigator as any;
    if (nav.mediaSession.setPositionState) {
      nav.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate,
        position: Math.max(0, Math.min(position, duration)),
      });
      mediaSessionLogger.log('position_update', { position, duration, playbackRate });
    }
  } catch (err) {
    // Position state errors are common and expected on some browsers
    if (isDev && isIOSSafari()) {
      console.warn('[MediaSession] Failed to update position state:', err);
    }
  }
}

/**
 * Safely update MediaSession metadata
 */
export function updateMetadata(title: string, artist: string, album: string, artwork: any[]) {
  if (!hasMediaSession()) return;
  
  try {
    const nav = navigator as any;
    if (typeof window !== 'undefined' && 'MediaMetadata' in window) {
      const meta = new (window as any).MediaMetadata({
        title,
        artist,
        album,
        artwork,
      });
      nav.mediaSession.metadata = meta;
      mediaSessionLogger.log('metadata_update', { title, artist, album });
    }
  } catch (err) {
    if (isDev) {
      console.warn('[MediaSession] Failed to update metadata:', err);
    }
  }
}
