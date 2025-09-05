"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { sanitizeText, logError, logInfo } from "@/lib/utils";
import { useToast } from "@/components/system/ToastProvider";

type Props = {
  specialUnlocked?: boolean;
  specialCode?: string;
  onPosted?: () => void;
};

export default function PostForm({ specialUnlocked, specialCode, onPosted }: Props) {
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const limit = 280;

  const remaining = limit - content.length;

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const clean = sanitizeText(content).slice(0, limit);
      const payload: {
        content: string;
        author_name: string;
        source: string;
        care_package_code?: string;
      } = {
        content: clean,
        author_name: sanitizeText(name) || "Anonymous",
        source: "web",
      };
      if (specialUnlocked) {
        payload.care_package_code = specialCode || "UNLOCKED";
      }
      const supabase = getSupabase();
      const { error } = await supabase.from("posts").insert(payload as unknown as object);
      if (error) throw error;
      setContent("");
      onPosted?.();
      logInfo("Post created", { special: !!payload.care_package_code });
      toast({ title: "Posted", description: "Your message is live.", variant: "success" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to post";
      setError(message);
      logError("Post error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-accent/50 rounded p-3 bg-surface/10">
      <div className="flex gap-2 mb-2">
        <input
          className="input w-40"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="ml-auto text-xs text-accent">{remaining} left</div>
      </div>
      <textarea
        className="input w-full min-h-24"
        maxLength={limit}
        placeholder={specialUnlocked ? "Care package drops get a badge" : "Say something to the wall"}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      
      {error && <div className="error-message text-sm mt-2">{error}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button className="btn inline-flex items-center gap-2" disabled={loading} onClick={submit} aria-busy={loading} aria-label="Post message">
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-electric-green border-t-transparent" />
              Posting...
            </>
          ) : (
            "Post"
          )}
        </button>
        {error && (
          <button className="btn" onClick={submit} aria-label="Retry posting">
            Retry
          </button>
        )}
        {specialUnlocked && (
          <span className="text-accent text-xs">Care package privileges active</span>
        )}
      </div>
    </div>
  );
}
