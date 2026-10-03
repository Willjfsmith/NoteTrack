import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttachmentData, EntryData, EntryRevision, Props, RowRef } from "@/lib/types";

const ENTRY_SELECT = `
  id, workspace_id, author_id, type, body_md, occurred_at, meeting_row_id, project_row_id, edited_at, struck_at,
  refs:entry_refs ( row:rows ( id, ref_code, title, table_id ) ),
  attachments ( id, entry_id, kind, file_path, mime, bytes, meta, created_at )
`;

export type EntryQuery = {
  limit?: number;
  /** ISO date (inclusive) */
  from?: string;
  /** ISO date (inclusive) */
  to?: string;
  projectRowId?: string;
  meetingRowId?: string;
  /** entries that reference this row, belong to it as a project, or are its meeting notes */
  rowId?: string;
  types?: EntryData["type"][];
  includeStruck?: boolean;
  ascending?: boolean;
};

export type AttachmentWithUrl = AttachmentData & { url: string | null };
export type EntryWithUrls = Omit<EntryData, "attachments"> & { attachments: AttachmentWithUrl[] };

export async function fetchEntries(workspaceId: string, opts: EntryQuery = {}): Promise<EntryWithUrls[]> {
  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from("entries")
    .select(ENTRY_SELECT)
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: opts.ascending ?? false })
    .limit(opts.limit ?? 200);

  if (opts.from) q = q.gte("occurred_at", `${opts.from}T00:00:00`);
  if (opts.to) q = q.lte("occurred_at", `${opts.to}T23:59:59.999`);
  if (opts.projectRowId) q = q.eq("project_row_id", opts.projectRowId);
  if (opts.meetingRowId) q = q.eq("meeting_row_id", opts.meetingRowId);
  if (opts.types?.length) q = q.in("type", opts.types);
  if (!opts.includeStruck) q = q.is("struck_at", null);

  if (opts.rowId) {
    const { data: refRows } = await supabase
      .from("entry_refs")
      .select("entry_id")
      .eq("row_id", opts.rowId)
      .limit(2000);
    const { data: srcRow } = await supabase
      .from("rows")
      .select("source_entry_id")
      .eq("id", opts.rowId)
      .maybeSingle();
    const ids = new Set((refRows ?? []).map((r) => r.entry_id as string));
    if (srcRow?.source_entry_id) ids.add(srcRow.source_entry_id as string);
    const clauses = [`project_row_id.eq.${opts.rowId}`, `meeting_row_id.eq.${opts.rowId}`];
    if (ids.size > 0) clauses.push(`id.in.(${Array.from(ids).join(",")})`);
    q = q.or(clauses.join(","));
  }

  const { data, error } = await q;
  if (error || !data) return [];

  type Raw = Omit<EntryData, "refs" | "linked" | "attachments"> & {
    refs: Array<{ row: RowRef | null }> | null;
    attachments: AttachmentData[] | null;
  };
  const raw = data as unknown as Raw[];

  // Rows created from these entries (Actions / Decisions / Risks).
  const ids = raw.map((e) => e.id);
  const linkedByEntry = new Map<string, RowRef & { props: Props }>();
  if (ids.length > 0) {
    const { data: linked } = await supabase
      .from("rows")
      .select("id, ref_code, title, table_id, props, source_entry_id")
      .in("source_entry_id", ids);
    for (const r of (linked ?? []) as Array<RowRef & { props: Props; source_entry_id: string }>) {
      linkedByEntry.set(r.source_entry_id, {
        id: r.id,
        ref_code: r.ref_code,
        title: r.title,
        table_id: r.table_id,
        props: r.props ?? {},
      });
    }
  }

  // Signed URLs for attachments (private bucket), one batch call.
  const paths = raw.flatMap((e) => (e.attachments ?? []).map((a) => a.file_path));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("attachments").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  return raw.map((e) => ({
    id: e.id,
    workspace_id: e.workspace_id,
    author_id: e.author_id,
    type: e.type,
    body_md: e.body_md,
    occurred_at: e.occurred_at,
    meeting_row_id: e.meeting_row_id,
    project_row_id: e.project_row_id,
    edited_at: e.edited_at,
    struck_at: e.struck_at,
    refs: (e.refs ?? []).map((r) => r.row).filter((r): r is RowRef => Boolean(r)),
    linked: linkedByEntry.get(e.id) ?? null,
    attachments: (e.attachments ?? []).map((a) => ({
      ...a,
      meta: a.meta ?? {},
      url: urlByPath.get(a.file_path) ?? null,
    })),
  }));
}

export async function fetchRevisions(entryId: string): Promise<EntryRevision[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entry_revisions")
    .select("id, body_md, replaced_at")
    .eq("entry_id", entryId)
    .order("replaced_at", { ascending: false });
  return (data ?? []) as EntryRevision[];
}
