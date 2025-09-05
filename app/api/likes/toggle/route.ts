import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Simple in-memory rate limiter (per-IP)
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 240;
function rateLimit(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const r = RATE.get(ip);
  if (!r || now - r.ts > WINDOW_MS) {
    RATE.set(ip, { count: 1, ts: now });
    return true;
  }
  if (r.count >= LIMIT) return false;
  r.count++;
  return true;
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const { post_id, session_token } = (await req.json()) as {
      post_id?: string;
      session_token?: string;
    };
    if (!post_id || !session_token)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (session_token.length < 16 || session_token.length > 200) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const supabase = getClient();
    // Check if like exists
    const { data: existing } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", post_id)
      .eq("session_token", session_token)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error: delErr } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post_id)
        .eq("session_token", session_token);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      // Recount likes
      const { count } = await supabase
        .from("post_likes")
        .select("post_id", { count: "exact", head: true })
        .eq("post_id", post_id);
      if (typeof count === "number") {
        await supabase.from("posts").update({ likes: count }).eq("id", post_id);
      }
      return NextResponse.json({ liked: false, likes: typeof count === "number" ? count : undefined });
    }

    // Like
    const { error: insErr } = await supabase
      .from("post_likes")
      .insert({ post_id, session_token });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    const { count } = await supabase
      .from("post_likes")
      .select("post_id", { count: "exact", head: true })
      .eq("post_id", post_id);
    if (typeof count === "number") {
      await supabase.from("posts").update({ likes: count }).eq("id", post_id);
    }
    return NextResponse.json({ liked: true, likes: typeof count === "number" ? count : undefined });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
