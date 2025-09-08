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
  
  // Validate post_id presence
  if (!post_id) return NextResponse.json({ error: "Missing post_id" }, { status: 400 });
  
  // Validate post_id format (UUID or reasonable length)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(post_id) && (post_id.length < 1 || post_id.length > 100)) {
    return NextResponse.json({ error: "Invalid post_id format" }, { status: 400 });
  }
  
  const supabase = getClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, author_name, content, created_at")
    .eq("post_id", post_id)
    .order("created_at", { ascending: true });
  
  if (error) {
    // Log full error server-side for debugging
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
  
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    
    let body: {
      post_id?: string;
      content?: string;
      author_name?: string;
    };
    
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    
    if (!body.post_id || !body.content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    
    const content = sanitizeText(body.content).slice(0, 1000);
    const author = body.author_name ? sanitizeText(body.author_name).slice(0, 100) : "Anonymous";
    
    // Validate sanitized content is non-empty
    if (!content.trim()) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
    }
    
    const supabase = getClient();
    const { error } = await supabase.from("comments").insert({
      post_id: body.post_id,
      content,
      author_name: author,
    });
    
    if (error) {
      // Log full error server-side for debugging
      console.error("Failed to create comment:", error);
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    // Log unexpected errors server-side
    console.error("Unexpected error in POST /api/comments:", e);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
