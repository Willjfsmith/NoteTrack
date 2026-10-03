import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchHit = {
  kind: "row" | "entry";
  id: string;
  ref_code: string | null;
  title: string;
  snippet: string;
  occurred_at: string;
  rank: number;
};

export async function searchWorkspace(workspaceId: string, q: string, limit = 40): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_workspace", {
    p_ws: workspaceId,
    p_q: term,
    p_limit: limit,
  });
  if (error) return [];
  return (data ?? []) as SearchHit[];
}
