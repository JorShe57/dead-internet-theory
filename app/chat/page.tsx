"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import GlitchText from "@/components/ui/GlitchText";
import { fetchWithTimeoutRetry } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useToast } from "@/components/system/ToastProvider";

type Msg = { id: string; role: "user" | "bot"; text: string; ts: number };

const STORAGE_KEY = "dit_chat_history";

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { online } = useNetworkStatus();
  const { toast } = useToast();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-200)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID?.() || String(Date.now()), role: "user", text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    try {
      const res = await fetchWithTimeoutRetry("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      }, { timeoutMs: 15000, retries: 1, backoffMs: 800 });
      const data = await res.json().catch(() => ({ reply: "" }));
      if (!res.ok) throw new Error(data.error || "Chat error");
      const botText: string = String(data.reply ?? "").trim() || "...";
      const botMsg: Msg = { id: crypto.randomUUID?.() || String(Date.now() + 1), role: "bot", text: botText, ts: Date.now() };
      setMessages((m) => [...m, botMsg]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      toast({ title: "Chat failed", description: msg, variant: "error" });
      // Offer a simple failure message
      const botMsg: Msg = { id: crypto.randomUUID?.() || String(Date.now() + 1), role: "bot", text: "Signal lost. Try again.", ts: Date.now() };
      setMessages((m) => [...m, botMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl text-center rounded-xl border border-electric-green/20 bg-deep-charcoal/40 backdrop-blur-md p-6 shadow-xl space-y-5">
        <GlitchText text="THE DEAD INTERNET THEORY" className="text-2xl sm:text-4xl text-electric-green" />
        {!online && (
          <div className="text-sm text-digital-blue">Offline — messages will send when back online.</div>
        )}

        <div className="h-[50vh] overflow-y-auto border border-accent/30 rounded p-3 bg-surface/10 text-left">
          {messages.length === 0 ? (
            <div className="text-sm opacity-80">Start a conversation. Ask about the dead internet.</div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <ChatBubble key={m.id} role={m.role} text={m.text} />
              ))}
              {sending && <TypingBubble />}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) void sendMessage();
          }}
        >
          <input
            className="input flex-1"
            placeholder="Speak to the theory..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message"
          />
          <button
            className="btn inline-flex items-center gap-2"
            type="submit"
            disabled={!canSend}
            aria-busy={sending}
            aria-label="Send message"
          >
            {sending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-electric-green border-t-transparent" />
                Sending
              </>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "user" | "bot"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`max-w-[85%] ${isUser ? "ml-auto" : "mr-auto"}`}>
      <div className={`text-xs mb-1 ${isUser ? "text-accent/80 text-right" : "text-digital-blue/80"}`}>
        {isUser ? "You" : "Dead Internet"}
      </div>
      <div className={`rounded px-3 py-2 leading-relaxed border ${isUser ? "border-accent text-foreground bg-deep-charcoal/40" : "border-digital-blue text-foreground bg-deep-charcoal/30"}`}>
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="mr-auto max-w-[85%]">
      <div className="text-xs mb-1 text-digital-blue/80">Dead Internet</div>
      <div className="rounded px-3 py-2 border border-digital-blue bg-deep-charcoal/30 inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse [animation-delay:120ms]" />
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse [animation-delay:240ms]" />
      </div>
    </div>
  );
}
