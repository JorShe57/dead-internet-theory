"use client";
import { fetchWithTimeoutRetry } from "@/lib/utils";

const STORAGE_KEY = "dit_session_token";
const EXP_KEY = "dit_session_expires";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(STORAGE_KEY);
  const exp = localStorage.getItem(EXP_KEY);
  if (!t || !exp) return null;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(EXP_KEY);
    } catch {}
    return null;
  }
  return t;
}

export function setSessionToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem(EXP_KEY, String(Date.now() + SESSION_TTL_MS));
  
  // Also set as HTTP-only cookie for server-side access
  document.cookie = `dit_session_token=${token}; path=/; max-age=${SESSION_TTL_MS / 1000}; secure; samesite=strict`;
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(EXP_KEY);
  
  // Also clear the cookie
  document.cookie = `dit_session_token=; path=/; max-age=0; secure; samesite=strict`;
}

export async function validateSession(token?: string): Promise<boolean> {
  try {
    const t = token ?? getSessionToken();
    if (!t) return false;
    const res = await fetchWithTimeoutRetry("/api/auth", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${t}`
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return !!data.ok;
  } catch {
    return false;
  }
}

export async function exchangeCodeForSession(code: string) {
  const res = await fetchWithTimeoutRetry("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }, { timeoutMs: 8000, retries: 2 });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Invalid code" }));
    throw new Error(e.error || "Invalid code");
  }
  const data = (await res.json()) as {
    token: string;
    type: string;
  };
  setSessionToken(data.token);
  return data;
}

export async function signOut() {
  const t = getSessionToken();
  if (t) {
    try {
      await fetchWithTimeoutRetry("/api/auth", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${t}`,
          "content-type": "application/json"
        }
      });
    } catch (error) {
      console.error("Failed to sign out on server:", error);
    } finally {
      clearSessionToken();
    }
  }
}

/**
 * Server-side session validation using Supabase directly
 * @param token - Session token to validate
 * @returns Promise<boolean> - True if session is valid
 */
export async function validateSessionServerSide(token: string): Promise<boolean> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.error("[DIT][auth] Missing Supabase credentials");
      return false;
    }
    
    const supabase = createClient(url, key);
    const TTL_HOURS = 24;
    
    const { data, error } = await supabase
      .from("user_sessions")
      .select("id, last_active")
      .eq("session_token", token)
      .maybeSingle();
      
    if (error) {
      console.error("[DIT][auth] Database error:", error);
      return false;
    }
    
    if (!data) return false;
    
    // TTL enforcement
    const last = data.last_active ? new Date(data.last_active) : null;
    if (!last || Date.now() - last.getTime() > TTL_HOURS * 60 * 60 * 1000) {
      // Clean up expired session
      await supabase.from("user_sessions").delete().eq("session_token", token);
      return false;
    }
    
    // Best-effort touch
    await supabase
      .from("user_sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("session_token", token);
      
    return true;
  } catch (error) {
    console.error("[DIT][auth] Server-side validation error:", error);
    return false;
  }
}
