export function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function truncate(str: string, max = 140) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export type FetchRetryOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
};

export async function fetchWithTimeoutRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: FetchRetryOptions = {}
) {
  const { timeoutMs = 8000, retries = 2, backoffMs = 500 } = opts;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(t);
      return res;
    } catch (e) {
      clearTimeout(t);
      attempt++;
      if (attempt > retries) throw e;
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
  }
}

export function sanitizeText(input: string) {
  // Basic sanitize: strip control chars and script-ish tags
  return input.replace(/<\/?script[^>]*>/gi, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

export function logInfo(...args: any[]) {
  // Centralized place for logging; can be toggled later
  // eslint-disable-next-line no-console
  console.info("[DIT]", ...args);
}

export function logError(...args: any[]) {
  // eslint-disable-next-line no-console
  console.error("[DIT]", ...args);
}

// Client-only hooks are defined in lib/hooks/* to keep this file SSR-safe.
