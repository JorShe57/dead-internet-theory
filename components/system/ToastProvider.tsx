"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
  durationMs?: number;
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timeoutRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef(true);
  
  const genId = () => {
    try {
      const g = globalThis as { crypto?: { randomUUID?: () => string } };
      if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    } catch {}
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };
  
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = genId();
    const item: Toast = { id, durationMs: 3000, ...t };
    setItems((prev) => [...prev, item]);
    
    const timeoutId = setTimeout(() => {
      // Clear the timeout from our tracking set
      timeoutRef.current.delete(timeoutId);
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    }, item.durationMs);
    
    // Track the timeout
    timeoutRef.current.add(timeoutId);
  }, [genId]);

  const value = useMemo(() => ({ toast }), [toast]);

  // Cleanup effect to clear all timeouts on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear all remaining timeouts
      timeoutRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutRef.current.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              `rounded border px-3 py-2 shadow transition ` +
              (t.variant === "error"
                ? "border-digital-blue text-digital-blue bg-surface/10"
                : t.variant === "success"
                ? "border-accent text-deep-charcoal bg-electric-green"
                : "border-accent/50 text-foreground bg-surface/10")
            }
          >
            <div className="font-medium">{t.title}</div>
            {t.description && (
              <div className="text-sm opacity-80">{t.description}</div>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
