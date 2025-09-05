"use client";
import { useEffect } from "react";
import { checkSupabaseConnection } from "@/lib/supabase";
import { logInfo, logError } from "@/lib/utils";

export default function ClientInit() {
  useEffect(() => {
    let mounted = true;
    (async () => {
      logInfo("Running startup checks...");
      const res = await checkSupabaseConnection();
      if (!mounted) return;
      if (res.ok) logInfo("Startup: Supabase OK");
      else logError("Startup: Supabase failed", res.error);
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return null;
}

