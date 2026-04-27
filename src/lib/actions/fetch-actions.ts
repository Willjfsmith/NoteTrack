import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionRow } from "./types";

type RawAction = {
  entry_id: string;
  status: ActionRow["status"];
  due_at: string | null;
  done_at: string | null;
  owner: ActionRow["owner"] | ActionRow["owner"][] | null;
  requester: ActionRow["requester"] | ActionRow["requester"][] | null;
  entry: { body_md: string; occurred_at: string } | { body_md: string; occurred_at: string }[] | null;
};

export async function fetchActions(
  projectId: string,
  filter: { tab: "on-you" | "i-requested" | "watching" | "all"; userId: string | null },
): Promise<ActionRow[]> {
  const supabase = await createSupabaseServerClient();

  // Resolve current user's person row (if any) for `on-you` and `i-requested`.
  let myPersonId: string | null = null;
  if (filter.userId) {
    const { data: me } = await supabase
      .from("people")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", filter.userId)
      .maybeSingle();
    myPersonId = me?.id ?? null;
  }

  let q = supabase
    .from("actions")
    .select(
      `
      entry_id, status, due_at, done_at,
      owner:owner_person_id ( id, short_id, name, initials, color ),
      requester:requester_person_id ( id, short_id, name, initials, color ),
      entry:entry_id!inner ( body_md, occurred_at, project_id )
    `,
    )
    .eq("entry.project_id", projectId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filter.tab === "on-you" && myPersonId) q = q.eq("owner_person_id", myPersonId);
  else if (filter.tab === "i-requested" && myPersonId) q = q.eq("requester_person_id", myPersonId);
  // `watching` and `all` get the whole project; refining `watching` later via watches table.

  const { data, error } = await q;
  if (error || !data) return [];

  const rows = data as unknown as RawAction[];

  // Pull source item refs in a second query (the first linked #ref per entry).
  const entryIds = rows.map((r) => r.entry_id);
  const refsByEntry: Record<string, string> = {};
  if (entryIds.length > 0) {
    const { data: refs } = await supabase
      .from("entry_refs")
      .select("entry_id, ref_id, items:ref_id ( ref_code )")
      .eq("ref_kind", "item")
      .in("entry_id", entryIds);
    for (const ref of (refs ?? []) as Array<{
      entry_id: string;
      items: { ref_code: string } | { ref_code: string }[] | null;
    }>) {
      if (refsByEntry[ref.entry_id]) continue;
      const code = Array.isArray(ref.items) ? ref.items[0]?.ref_code : ref.items?.ref_code;
      if (code) refsByEntry[ref.entry_id] = code;
    }
  }

  return rows.map((r) => {
    const entry = Array.isArray(r.entry) ? r.entry[0] : r.entry;
    const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
    const requester = Array.isArray(r.requester) ? r.requester[0] : r.requester;
    return {
      entry_id: r.entry_id,
      body_md: entry?.body_md ?? "",
      occurred_at: entry?.occurred_at ?? "",
      status: r.status,
      due_at: r.due_at,
      done_at: r.done_at,
      owner: owner ?? null,
      requester: requester ?? null,
      source_item_ref: refsByEntry[r.entry_id] ?? null,
    };
  });
}

export async function fetchProjectPeople(projectId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("people")
    .select("id, short_id, name, initials, color, user_id")
    .eq("project_id", projectId)
    .order("name");
  return data ?? [];
}
