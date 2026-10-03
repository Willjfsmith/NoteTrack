"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Refresh the server-rendered page when a table changes (entries / rows are in the realtime publication). */
export function RefreshOnChange({ table, filter }: { table: "entries" | "rows"; filter: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`refresh-${table}-${filter}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => router.refresh(), 250);
      })
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [router, table, filter]);
  return null;
}
