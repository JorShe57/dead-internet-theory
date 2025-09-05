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
  const expired = Date.now() > Number(exp);
  if (expired) {
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
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(EXP_KEY);
}

export async function validateSession(token?: string): Promise<boolean> {
  try {
    const t = token ?? getSessionToken();
    if (!t) return false;
    const res = await fetchWithTimeoutRetry(`/api/auth?token=${encodeURIComponent(t)}`, {
      method: "GET",
      headers: { "content-type": "application/json" },
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
    await fetchWithTimeoutRetry(`/api/auth?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    clearSessionToken();
  }
}
