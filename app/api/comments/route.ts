import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/utils";

// Simple in-memory rate limiter (per-IP)
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 120;
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const post_id = searchParams.get("post_id");
  if (!post_id) return NextResponse.json({ error: "Missing post_id" }, { status: 400 });
  const supabase = getClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", post_id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const body = (await req.json()) as {
      post_id?: string;
      content?: string;
      author_name?: string;
    };
    if (!body.post_id || !body.content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const content = sanitizeText(body.content).slice(0, 1000);
    const author = body.author_name ? sanitizeText(body.author_name).slice(0, 100) : "Anonymous";
    const supabase = getClient();
    const { error } = await supabase.from("comments").insert({
      post_id: body.post_id,
      content,
      author_name: author,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
