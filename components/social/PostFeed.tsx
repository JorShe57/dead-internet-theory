"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Post } from "@/types";
import { useRouter } from "next/navigation";
import { logError, logInfo } from "@/lib/utils";

export default function PostFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"connecting" | "subscribed" | "error" | "fallback">("connecting");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentPreview, setCommentPreview] = useState<Record<string, Array<{ author_name: string | null; content: string }>>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) logError("Fetch posts error:", error.message);
      if (mounted) {
        setPosts(data ?? []);
        setLoading(false);
      }
      // After posts load, compute liked state and comment counts/previews
      try {
        const ids = (data ?? []).map((p) => p.id);
        if (ids.length === 0) return;
        const supa = getSupabase();
        // comments: pull recent and count locally
        const { data: allComments } = await supa
          .from('comments')
          .select('post_id, content, author_name, created_at')
          .in('post_id', ids)
          .order('created_at', { ascending: false });
        const counts: Record<string, number> = {};
        const previews: Record<string, Array<{ author_name: string | null; content: string }>> = {};
        (allComments ?? []).forEach((c: any) => {
          counts[c.post_id] = (counts[c.post_id] || 0) + 1;
          if (!previews[c.post_id]) previews[c.post_id] = [];
          if (previews[c.post_id].length < 2) previews[c.post_id].push({ author_name: c.author_name, content: c.content });
        });
        if (mounted) {
          setCommentCounts(counts);
          setCommentPreview(previews);
        }
        // likes set for current session
        const t = typeof window !== 'undefined' ? localStorage.getItem('dit_session_token') : null;
        if (t) {
          const { data: likedRows } = await supa
            .from('post_likes')
            .select('post_id')
            .eq('session_token', t)
            .in('post_id', ids);
          const set = new Set<string>((likedRows ?? []).map((r: any) => r.post_id as string));
          if (mounted) setLiked(set);
        }
      } catch (e) {
        logError('augment posts failed', e);
      }
    };
    load();

    const supabase = getSupabase();
    const channel = supabase
      .channel("posts-change")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev].slice(0, 100));
        }
      )
      .subscribe((s) => {
        logInfo("Realtime status:", s);
        if (s === "SUBSCRIBED") setStatus("subscribed");
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("error");
          if (!pollRef.current) {
            pollRef.current = setInterval(load, 5000);
            setStatus("fallback");
          }
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  if (loading)
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-accent/30 rounded p-3 bg-surface/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="skeleton skeleton-text w-24" />
              <div className="skeleton skeleton-text w-12" />
            </div>
            <div className="skeleton skeleton-text w-3/4 mb-2" />
            <div className="skeleton skeleton-text w-2/3" />
          </div>
        ))}
      </div>
    );
  if (!loading && posts.length === 0)
    return (
      <div className="border border-accent/50 rounded p-6 bg-surface/10 text-center">
        <div className="text-electric-green mb-2">No transmissions yet.</div>
        <div className="text-sm opacity-80">Be the first to drop a message.</div>
      </div>
    );

  return (
    <div className="grid gap-3">
      <div className="text-xs">Realtime: {status === "subscribed" ? "connected" : status}</div>
      {posts.map((p) => (
        <article key={p.id} className="border border-accent/50 rounded p-3 bg-surface/10">
          <div className="flex items-center gap-2 text-xs text-accent mb-1">
            <span>{p.author_name || "Anonymous"}</span>
            <span>•</span>
            <time dateTime={p.created_at}>
              {new Date(p.created_at).toLocaleTimeString()}
            </time>
            {p.care_package_code && (
              <span className="ml-auto inline-flex items-center gap-1 text-accent">
                <span className="h-2 w-2 bg-accent rounded-full" /> Care Package
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{p.content}</p>
          
          <div className="mt-2 flex items-center gap-3 text-xs">
            {(() => { const isLiked = liked.has(p.id); return (
            <button
              className={`btn ${isLiked ? 'bg-accent text-deep-charcoal' : ''}`}
              onClick={async () => {
                try {
                  const t = localStorage.getItem('dit_session_token');
                  if (!t) return router.push('/');
                  const res = await fetch('/api/likes/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post_id: p.id, session_token: t }) });
                  const data = await res.json();
                  if (res.ok) {
                    setPosts((prev) => prev.map(pp => pp.id === p.id ? { ...pp, likes: typeof data.likes === 'number' ? data.likes : pp.likes } : pp));
                    setLiked((prev) => { const n = new Set(prev); if (data.liked) n.add(p.id); else n.delete(p.id); return n; });
                  }
                } catch (e) {
                  logError('like toggle failed', e);
                }
              }}
              aria-label="Like post"
            >
              {isLiked ? '♥' : '♡'} {p.likes}
            </button>
            ); })()}
            <a href={`#comments-${p.id}`} className="underline underline-offset-2">Comments ({commentCounts[p.id] || 0})</a>
          </div>
          {commentPreview[p.id] && commentPreview[p.id].length > 0 && (
            <div className="mt-1 space-y-1">
              {commentPreview[p.id].map((c, idx) => (
                <div key={idx} className="text-xs opacity-80">
                  <span className="opacity-70">{c.author_name || 'Anonymous'}:</span> {c.content}
                </div>
              ))}
            </div>
          )}
          <details id={`comments-${p.id}`} className="mt-2">
            <summary className="cursor-pointer text-accent">View comments</summary>
            <CommentSection postId={p.id} />
          </details>
        </article>
      ))}
    </div>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const supabase = getSupabase();
  const [items, setItems] = useState<Array<{ id: string; content: string; author_name: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (mounted) { setItems(data ?? []); setLoading(false); }
    };
    load();
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, (payload) => {
        setItems((prev) => [...prev, payload.new as any]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); mounted = false; };
  }, [postId]);
  return (
    <div className="mt-2 border border-accent/30 rounded p-2">
      {loading ? (
        <div className="text-xs text-accent">Loading comments...</div>
      ) : items.length === 0 ? (
        <div className="text-xs opacity-80">No comments yet.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="opacity-80">{c.author_name || 'Anonymous'}:</span> {c.content}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const clean = (text || '').trim();
          if (!clean) return;
          await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post_id: postId, content: clean }) });
          setText('');
        }}
      >
        <input className="input flex-1" placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Send</button>
      </form>
    </div>
  );
}
