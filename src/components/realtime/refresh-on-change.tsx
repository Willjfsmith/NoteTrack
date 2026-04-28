"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Subscribe to a Supabase Realtime channel for a given table+filter and call
 * `router.refresh()` whenever a change happens — cheap way to keep server-
 * rendered registers in sync without each component implementing its own
 * cache patching.
 */
export function RefreshOnChange({
  table,
  filter,
}: {
  table: "entries" | "actions" | "items";
  /** Postgres filter string, e.g. `project_id=eq.<uuid>`. */
  filter: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`refresh-${table}-${filter}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router, table, filter]);
  return null;
}
