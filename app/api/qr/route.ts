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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const { qr } = (await req.json()) as { qr?: string };
    console.info("[DIT][qr][POST] incoming", { qr: qr?.slice(0, 8) });
    if (!qr) return NextResponse.json({ error: "Missing qr" }, { status: 400 });
    const code = sanitizeText(qr).toUpperCase();
    const supabase = getClient();
    const { data: access, error } = await supabase
      .from("access_codes")
      .select("code, type, active")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!access) return NextResponse.json({ valid: false }, { status: 200 });
    return NextResponse.json({ valid: true, type: access.type ?? "album", code: access.code });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
