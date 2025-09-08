import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID as nodeRandomUUID } from "crypto";
import { sanitizeText } from "@/lib/utils";

// Simple in-memory rate limiter (best-effort for dev)
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 60; // 60 requests per minute per ip

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const { code } = (await req.json()) as { code?: string };
    console.info("[DIT][auth][POST] incoming", { code: code?.slice(0, 6) });
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });
    const input = sanitizeText(code).toUpperCase();
    const supabase = getClient();
    const { data: access, error } = await supabase
      .from("access_codes")
      .select("id, code, type, active")
      .eq("code", input)
      .eq("active", true)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!access) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

    // Create session row with retry on unique collisions
    let token = newToken();
    let insertSuccess = false;
    
    for (let i = 0; i < 3; i++) {
      const { error: insErr } = await supabase
        .from("user_sessions")
        .insert({ 
          session_token: token,
          last_active: new Date().toISOString()
        });
      
      if (!insErr) {
        insertSuccess = true;
        break;
      }
      
      // Only retry on unique violation errors
      if ((insErr as { code?: string }).code === "23505") {
        token = newToken();
        continue;
      }
      
      // Propagate any non-23505 error immediately
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    
    // Verify the insert succeeded after the loop
    if (!insertSuccess) {
      return NextResponse.json({ error: "Failed to create session after retries" }, { status: 500 });
    }

    return NextResponse.json({ token, type: access.type ?? "album" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const TTL_HOURS = 24;
  console.info("[DIT][auth][GET] validate session");
  const supabase = getClient();
  
  // Extract token from Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const { data, error } = await supabase
    .from("user_sessions")
    .select("id, last_active")
    .eq("session_token", token)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false }, { status: 401 });
  // TTL enforcement
  const last = data.last_active ? new Date(data.last_active) : null;
  if (!last || Date.now() - last.getTime() > TTL_HOURS * 60 * 60 * 1000) {
    await supabase.from("user_sessions").delete().eq("session_token", token);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // Best-effort touch
  await supabase
    .from("user_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("session_token", token);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  console.info("[DIT][auth][DELETE] sign out");
  const supabase = getClient();
  
  // Extract token from Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  await supabase.from("user_sessions").delete().eq("session_token", token);
  return NextResponse.json({ ok: true });
}
export const runtime = "nodejs";

function newToken() {
  try {
    // Prefer Node's randomUUID
    if (typeof nodeRandomUUID === "function") return nodeRandomUUID();
  } catch {}
  try {
    // Fallback to secure random bytes (32 hex chars)
    return randomBytes(16).toString("hex");
  } catch {}
  // Last-resort, non‑cryptographic fallback
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
