"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

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
  const genId = () => {
    try {
      const g: any = globalThis as any;
      if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    } catch {}
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = genId();
    const item: Toast = { id, durationMs: 3000, ...t };
    setItems((prev) => [...prev, item]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, item.durationMs);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

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
