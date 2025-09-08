"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { fetchWithTimeoutRetry } from "@/lib/utils";

type Msg = { id: string; role: "user" | "bot"; text: string; ts: number };

export default function GuardianChat() {
  const [messages, setMessages] = useState<Msg[]>(() => {
    // Ephemeral: start empty every time (no localStorage)
    return [
      {
        id: String(Date.now()),
        role: "bot",
        text: "I am the Password Guardian. Ask me for the access code.",
        ts: Date.now(),
      },
    ];
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

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
      const res = await fetchWithTimeoutRetry(
        "/api/guardian",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
        },
        { timeoutMs: 15000, retries: 1, backoffMs: 800 }
      );
      const data = await res.json().catch(() => ({ reply: "" }));
      if (!res.ok) throw new Error(data.error || "Guardian error");
      const botText: string = String(data.reply ?? "").trim() || "...";
      const botMsg: Msg = { id: crypto.randomUUID?.() || String(Date.now() + 1), role: "bot", text: botText, ts: Date.now() };
      setMessages((m) => [...m, botMsg]);
    } catch (e: unknown) {
      const botMsg: Msg = {
        id: crypto.randomUUID?.() || String(Date.now() + 1),
        role: "bot",
        text: "I could not reach the gate. Try again soon.",
        ts: Date.now(),
      };
      setMessages((m) => [...m, botMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 border border-accent/30 rounded p-3 bg-surface/10">
      <div className="text-accent text-sm mb-2">
        Hint: Ask the Password Guardian below for the access code.
      </div>
      <div className="h-60 overflow-y-auto border border-accent/20 rounded p-2 bg-deep-charcoal/30">
        {messages.length === 0 ? (
          <div className="text-sm opacity-80">Say hello to the Guardian.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} />
            ))}
            {sending && <Typing />}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) void sendMessage();
        }}
      >
        <input
          className="input flex-1"
          placeholder="Ask the Guardian..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Guardian message"
        />
        <button className="btn" type="submit" disabled={!canSend} aria-busy={sending} aria-label="Send">
          {sending ? "Sending" : "Send"}
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "bot"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`max-w-[85%] ${isUser ? "ml-auto" : "mr-auto"}`}>
      <div className={`text-xs mb-1 ${isUser ? "text-accent/80 text-right" : "text-digital-blue/80"}`}>
        {isUser ? "You" : "Guardian"}
      </div>
      {isUser ? (
        <div className={`rounded px-3 py-2 leading-relaxed border border-accent text-foreground bg-deep-charcoal/40 whitespace-pre-wrap`}>
          {text}
        </div>
      ) : (
        <pre className="code-block whitespace-pre-wrap overflow-x-auto">{text}</pre>
      )}
    </div>
  );
}

function Typing() {
  return (
    <div className="mr-auto max-w-[85%]">
      <div className="text-xs mb-1 text-digital-blue/80">Guardian</div>
      <div className="rounded px-3 py-2 border border-digital-blue bg-deep-charcoal/30 inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse [animation-delay:120ms]" />
        <span className="h-2 w-2 rounded-full bg-electric-green animate-pulse [animation-delay:240ms]" />
      </div>
    </div>
  );
}

