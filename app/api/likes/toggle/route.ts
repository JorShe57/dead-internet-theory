import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Validate required environment variables at module startup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL.trim() === "") {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is required but not set or empty");
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === "") {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required but not set or empty");
}

// TypeScript assertion: we know these are non-empty strings after validation
const validatedSupabaseUrl: string = SUPABASE_URL;
const validatedSupabaseAnonKey: string = SUPABASE_ANON_KEY;

// Simple in-memory rate limiter (per-IP)
// NOTE: For production, consider replacing this with a centralized store (Redis/Upstash)
// or a managed rate-limiter to ensure consistent, cross-instance rate limiting
const RATE = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 240;

/**
 * Robustly extracts and validates client IP from request headers
 * @param req - NextRequest object
 * @returns Sanitized IP string or "unknown" if no valid IP found
 */
function extractClientIP(req: NextRequest): string {
  // IPv4 regex: matches 0.0.0.0 to 255.255.255.255
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex: matches various IPv6 formats including compressed notation
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:)*::$/;
  
  /**
   * Validates if a string is a valid IPv4 or IPv6 address
   */
  function isValidIP(ip: string): boolean {
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
  
  /**
   * Sanitizes IP by removing port suffix and trimming whitespace
   */
  function sanitizeIP(ip: string): string {
    return ip.split(':')[0].trim();
  }
  
  try {
    // Try x-forwarded-for header first (can contain multiple IPs)
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const candidates = forwardedFor
        .split(',')
        .map(ip => sanitizeIP(ip))
        .filter(ip => ip.length > 0);
      
      // Find first valid IP
      for (const candidate of candidates) {
        if (isValidIP(candidate)) {
          return candidate;
        }
      }
    }
    
    // Fall back to x-real-ip header
    const realIP = req.headers.get("x-real-ip");
    if (realIP) {
      const sanitized = sanitizeIP(realIP);
      if (isValidIP(sanitized)) {
        return sanitized;
      }
    }

    // Final fallback
    return "unknown";
  } catch (_error) {
    // Ensure we never crash on header parsing errors
    return "unknown";
  }
}

function rateLimit(req: NextRequest) {
  const ip = extractClientIP(req);
  const now = Date.now();
  
  // Clean up expired entries to prevent memory leak
  for (const [key, value] of RATE.entries()) {
    if (now - value.ts > WINDOW_MS) {
      RATE.delete(key);
    }
  }
  
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
  return createClient(validatedSupabaseUrl, validatedSupabaseAnonKey);
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    
    // Parse request body without type assertion
    const body: any = await req.json();
    
    // Runtime validation of required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    
    const { post_id, session_token } = body;
    
    // Validate post_id exists and is a string
    if (!post_id || typeof post_id !== 'string') {
      return NextResponse.json({ error: "Missing or invalid post_id" }, { status: 422 });
    }
    
    // Validate session_token exists and is a string
    if (!session_token || typeof session_token !== 'string') {
      return NextResponse.json({ error: "Missing or invalid session_token" }, { status: 422 });
    }
    
    // Additional validation for session_token length
    if (session_token.length < 16 || session_token.length > 200) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    
    // Now we have validated values, use them for subsequent logic
    const validatedPostId: string = post_id;
    const validatedSessionToken: string = session_token;
    const supabase = getClient();
    
    // Use atomic stored procedure to toggle like and get updated count
    const { data, error } = await supabase.rpc('toggle_post_like', {
      p_post_id: validatedPostId,
      p_session_token: validatedSessionToken
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The stored procedure returns an array with one row containing liked and likes_count
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
    }

    const result = data[0];
    return NextResponse.json({ 
      liked: result.liked, 
      likes: result.likes_count 
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
