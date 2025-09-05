"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logError, logInfo } from "@/lib/utils";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env vars are not set.");
  }
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

export async function checkSupabaseConnection() {
  try {
    const client = getSupabase();
    const { error } = await client.from("access_codes").select("id").limit(1);
    if (error) {
      logError("Supabase connection check failed:", error.message);
      return { ok: false, error: error.message } as const;
    }
    logInfo("Supabase connection OK");
    return { ok: true } as const;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("Supabase init error:", msg);
    return { ok: false, error: msg } as const;
  }
}
