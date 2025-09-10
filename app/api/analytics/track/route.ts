import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  event?: "start" | "end" | "progress";
  track_key?: string;
  play_id?: string;
  position_ms?: number;
  duration_ms?: number;
  idempotency_key?: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  return createClient(url, key);
}

function clientIP(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const xr = req.headers.get("x-real-ip");
  return xr?.trim() ?? null;
}

// very small per-IP rate limiter (best-effort)
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 600; // generous
function rateLimit(req: NextRequest): boolean {
  const ip = clientIP(req) || "unknown";
  const now = Date.now();
  const r = RATE.get(ip);
  if (!r || now - r.ts > WINDOW_MS) { RATE.set(ip, { count: 1, ts: now }); return true; }
  if (r.count >= LIMIT) return false;
  r.count++; return true;
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    let body: Body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const event = body.event;
    const trackKey = body.track_key;
    if (!event || (event !== "start" && event !== "end" && event !== "progress"))
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });

    if ((event === "start" || event === "progress") && (!trackKey || typeof trackKey !== "string"))
      return NextResponse.json({ error: "Missing track_key" }, { status: 400 });

    const supabase = getSupabase();
    const ip = clientIP(req);
    const ua = req.headers.get("user-agent") || undefined;

    // Session token from Authorization header if provided
    const authHeader = req.headers.get("authorization");
    const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (event === "start") {
      const { idempotency_key } = body;
      // If client supplied an idempotency_key, upsert to avoid dupes
      if (idempotency_key) {
        const { data, error } = await supabase
          .from("track_plays")
          .upsert({
            idempotency_key,
            track_key: trackKey!,
            session_token: sessionToken || null,
            user_agent: ua || null,
            ip: ip || null,
          }, { onConflict: "idempotency_key" })
          .select("id")
          .maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ play_id: data?.id });
      }
      // Otherwise insert a new row
      const { data, error } = await supabase
        .from("track_plays")
        .insert({ track_key: trackKey!, session_token: sessionToken || null, user_agent: ua || null, ip: ip || null })
        .select("id")
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ play_id: data?.id });
    }

    if (event === "progress") {
      // best-effort update current position
      const position = Math.max(0, Math.floor(Number(body.position_ms || 0)));
      const id = body.play_id;
      if (!id) return NextResponse.json({ ok: true });
      const { error } = await supabase
        .from("track_plays")
        .update({ ms_played: position })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (event === "end") {
      const id = body.play_id;
      if (!id) return NextResponse.json({ error: "Missing play_id" }, { status: 400 });
      const nowPlayed = Math.max(0, Math.floor(Number(body.position_ms ?? body.duration_ms ?? 0)));
      const { error } = await supabase
        .from("track_plays")
        .update({ completed: true, completed_at: new Date().toISOString(), ms_played: nowPlayed })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

