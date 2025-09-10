"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Track = { title: string; file: string };

type PlayerState = {
  queue: Track[];
  index: number;
};

type PlayerContextValue = {
  queue: Track[];
  index: number;
  current: Track | null;
  hasQueue: boolean;
  setQueue: (q: Track[], startIndex?: number) => void;
  playIndex: (i: number) => void;
  next: () => void;
  prev: () => void;
};

const Ctx = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>({ queue: [], index: 0 });

  const setQueue = useCallback((q: Track[], startIndex = 0) => {
    const i = Math.min(Math.max(startIndex, 0), Math.max(0, q.length - 1));
    setState({ queue: q, index: i });
  }, []);

  const playIndex = useCallback((i: number) => {
    setState((s) => {
      const next = Math.min(Math.max(i, 0), Math.max(0, s.queue.length - 1));
      return { ...s, index: next };
    });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (s.queue.length === 0) return s;
      return { ...s, index: (s.index + 1) % s.queue.length };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => {
      if (s.queue.length === 0) return s;
      return { ...s, index: (s.index - 1 + s.queue.length) % s.queue.length };
    });
  }, []);

  const value: PlayerContextValue = useMemo(() => {
    const current = state.queue[state.index] ?? null;
    return {
      queue: state.queue,
      index: state.index,
      current,
      hasQueue: state.queue.length > 0,
      setQueue,
      playIndex,
      next,
      prev,
    };
  }, [state, setQueue, playIndex, next, prev]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

