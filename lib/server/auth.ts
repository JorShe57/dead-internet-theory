import { createClient } from "@supabase/supabase-js";

/**
 * Server-side session validation using Supabase directly
 * @param token - Session token to validate
 * @returns Promise<boolean> - True if session is valid
 */
export async function validateSessionServerSide(token: string): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error("[DIT][auth][server] Missing Supabase credentials");
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
      console.error("[DIT][auth][server] Database error:", error);
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
    console.error("[DIT][auth][server] Validation error:", error);
    return false;
  }
}

