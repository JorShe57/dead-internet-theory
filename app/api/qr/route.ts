import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/utils";

// Simple in-memory rate limiter (best-effort for dev)
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 120; // QR can be more frequent

function keyFromReq(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return ip;
}

function rateLimit(req: NextRequest): boolean {
  const k = keyFromReq(req);
  const now = Date.now();
  const rec = RATE.get(k);
  if (!rec) {
    RATE.set(k, { count: 1, ts: now });
    return true;
  }
  if (now - rec.ts > WINDOW_MS) {
    RATE.set(k, { count: 1, ts: now });
    return true;
  }
  if (rec.count >= LIMIT) return false;
  rec.count++;
  return true;
}

function getClient() {
  // Prefer NEXT_PUBLIC_* to match the rest of the app, fall back to non-prefixed vars
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }

  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    
    // Parse and validate request body
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    const { qr } = body;
    if (!qr || typeof qr !== 'string') {
      return NextResponse.json({ error: "Missing or invalid qr field" }, { status: 400 });
    }
    
    // Trim and sanitize input
    const trimmedQr = qr.trim();
    const sanitizedQr = sanitizeText(trimmedQr);
    const code = sanitizedQr.toUpperCase();
    
    // Log only a preview of the sanitized value
    console.info("[DIT][qr][POST] incoming", { qr: code.slice(0, 8) });
    
    const supabase = getClient();
    const { data: access, error } = await supabase
      .from("access_codes")
      .select("code, type, active")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (error) {
      console.error("[DIT][qr][POST] Database error", { 
        error: error.message, 
        code: code.slice(0, 8), 
        details: error.details,
        hint: error.hint 
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!access) return NextResponse.json({ valid: false }, { status: 200 });
    return NextResponse.json({ valid: true, type: access.type ?? "album", code: access.code });
  } catch (e: unknown) {
    console.error("[DIT][qr][POST] Unexpected error", { 
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
