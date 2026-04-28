import { notFound } from "next/navigation";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderBody } from "@/lib/composer/render-body";
import { Composer } from "@/components/composer/composer";
import { WatchButton } from "@/components/items/watch-button";
import { FileUpload } from "@/components/library/file-upload";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_TONE: Record<string, string> = {
  note: "border-line bg-bg-2 text-ink-3",
  action: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink",
  decision: "border-tone-purple-bd bg-tone-purple-bg text-tone-purple-ink",
  risk: "border-tone-red-bd bg-tone-red-bg text-tone-red-ink",
  gate: "border-tone-green-bd bg-tone-green-bg text-tone-green-ink",
  meeting: "border-tone-yellow-bd bg-tone-yellow-bg text-tone-yellow-ink",
  call: "border-tone-orange-bd bg-tone-orange-bg text-tone-orange-ink",
};

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; ref: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { code, ref } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("code", code)
    .single();
  if (!project) notFound();

  const { data: item } = await supabase
    .from("items")
    .select(
      `id, ref_code, title, current_stage_id, updated_at, created_at, props,
       item_type:type_id ( key, name )`,
    )
    .eq("project_id", project.id)
    .eq("ref_code", ref)
    .maybeSingle();
  if (!item) notFound();

  type ItemTypeJoin = { key: string; name: string };
  const itemType = Array.isArray(item.item_type) ? item.item_type[0] : (item.item_type as ItemTypeJoin | null);

  const [{ data: stage }, { data: refRows }, { data: attachments }] = await Promise.all([
    item.current_stage_id
      ? supabase
          .from("pipeline_stages")
          .select("name")
          .eq("id", item.current_stage_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("entry_refs")
      .select(
        `entry:entry_id (
           id, body_md, occurred_at, project_id, props,
           entry_type:entry_type_id ( key )
         )`,
        { count: "exact" },
      )
      .eq("ref_kind", "item")
      .eq("ref_id", item.id)
      .order("entry(occurred_at)", { ascending: false })
      .range(0, 49),
    supabase
      .from("attachments")
      .select("id, file_path, mime, bytes, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
  ]);

  type EntryJoin = {
    id: string;
    body_md: string;
    occurred_at: string;
    project_id: string;
    props: Record<string, unknown> | null;
    entry_type: { key: string } | { key: string }[] | null;
  };
  type RefRow = { entry: EntryJoin | EntryJoin[] | null };

  const entries = ((refRows ?? []) as RefRow[])
    .map((r) => {
      const e = Array.isArray(r.entry) ? r.entry[0] : r.entry;
      if (!e || e.project_id !== project.id) return null;
      const et = Array.isArray(e.entry_type) ? e.entry_type[0] : e.entry_type;
      const props = (e.props ?? {}) as Record<string, unknown>;
      const typeKey = et?.key ?? "note";
      const risk =
        typeKey === "risk" && typeof props.probability === "number" && typeof props.impact === "number"
          ? {
              probability: props.probability as number,
              impact: props.impact as number,
              status: (props.status as string) ?? "open",
            }
          : null;
      return {
        entry: { id: e.id, type: typeKey, body_md: e.body_md, occurred_at: e.occurred_at },
        risk,
      };
    })
    .filter((r): r is { entry: { id: string; type: string; body_md: string; occurred_at: string }; risk: { probability: number; impact: number; status: string } | null } => r != null);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isWatching = false;
  if (user) {
    const { data } = await supabase
      .from("watches")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ref_kind", "item")
      .eq("ref_id", item.id)
      .maybeSingle();
    isWatching = Boolean(data);
  }

  const tab = sp.tab ?? "activity";
  const tabs = [
    { key: "activity", label: `Activity (${entries.length})` },
    { key: "files", label: `Files (${attachments?.length ?? 0})` },
    { key: "linked", label: "Linked" },
    { key: "risks", label: `Risks (${entries.filter((e) => e.entry.type === "risk").length})` },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start gap-3 border-b border-line pb-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-ink-3">
            {itemType?.name ?? itemType?.key ?? "item"} · #{item.ref_code}
          </div>
          <h1 className="mt-1 font-serif text-[28px] font-medium leading-tight tracking-tight">
            {item.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-ink-3">
            {stage?.name && (
              <span>
                Stage <b className="text-ink">{stage.name}</b>
              </span>
            )}
            <span>
              Created {format(parseISO(item.created_at), "d MMM")} · last updated{" "}
              {formatDistanceToNowStrict(parseISO(item.updated_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <WatchButton itemId={item.id} projectCode={project.code} initialWatching={isWatching} />
          <FileUpload projectId={project.id} defaultItemRef={item.ref_code} />
        </div>
      </div>

      <div className="mb-3 flex gap-0 border-b border-line">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/p/${project.code}/items/${item.ref_code}?tab=${t.key}`}
            className={cn(
              "mr-4 cursor-pointer border-b-2 py-2 text-[12px] font-medium",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="mb-4">
        <Composer projectId={project.id} placeholder={`Note something about #${item.ref_code}…`} />
      </div>

      {tab === "activity" && (
        <div>
          {entries.length === 0 ? (
            <div className="rounded-4 border border-dashed border-line p-8 text-center text-[12.5px] text-ink-3">
              No activity yet.
            </div>
          ) : (
            <ul>
              {entries.map(({ entry, risk }) => (
                <li key={entry.id} className="flex gap-3 border-b border-line py-2.5">
                  <span className="w-16 flex-none text-right font-mono text-[10.5px] text-ink-4">
                    {format(parseISO(entry.occurred_at), "d MMM HH:mm")}
                  </span>
                  <span
                    className={cn(
                      "h-5 flex-none rounded-1 border px-1 font-mono text-[10px] uppercase tracking-wider",
                      TYPE_TONE[entry.type] ?? TYPE_TONE.note,
                    )}
                  >
                    {entry.type}
                  </span>
                  <span className="flex-1 text-[13px] leading-[1.5]">
                    {renderBody(entry.body_md, { projectCode: project.code })}
                    {risk && (
                      <span className="ml-2 font-mono text-[10.5px] text-ink-4">
                        (p{risk.probability}·i{risk.impact} · {risk.status})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(attachments ?? []).length === 0 && (
            <div className="col-span-full rounded-4 border border-dashed border-line p-8 text-center text-[12.5px] text-ink-3">
              No files attached.
            </div>
          )}
          {(attachments ?? []).map((a) => (
            <article
              key={a.id}
              className="overflow-hidden rounded-3 border border-line bg-surface shadow-1"
            >
              <div className="grid h-24 place-items-center bg-bg-2 text-ink-3">
                {a.mime?.startsWith("image/") ? "🖼️" : a.mime === "application/pdf" ? "📄" : "📎"}
              </div>
              <div className="p-2 text-[12px]">
                <div className="truncate" title={a.file_path}>
                  {basename(a.file_path)}
                </div>
                <div className="font-mono text-[10px] text-ink-4">
                  {format(parseISO(a.created_at), "d MMM HH:mm")}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "linked" && (
        <div className="rounded-4 border border-dashed border-line p-8 text-center text-[12.5px] text-ink-3">
          (Linked items view — coming next.)
        </div>
      )}

      {tab === "risks" && (
        <ul>
          {entries
            .filter((e) => e.entry.type === "risk" && e.risk)
            .map(({ entry, risk }) =>
              risk ? (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-line py-2.5 text-[12.5px]"
                >
                  <span className="font-mono text-[11px] text-ink-3">
                    {format(parseISO(entry.occurred_at), "d MMM")}
                  </span>
                  <span className="flex-1">
                    {renderBody(entry.body_md, { projectCode: project.code })}
                  </span>
                  <span className="font-mono text-[11px] text-tone-red-ink">
                    p{risk.probability}·i{risk.impact} · {risk.probability * risk.impact}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-3">{risk.status}</span>
                </li>
              ) : null,
            )}
          {entries.filter((e) => e.entry.type === "risk").length === 0 && (
            <div className="rounded-4 border border-dashed border-line p-8 text-center text-[12.5px] text-ink-3">
              No risks linked to this item.
            </div>
          )}
        </ul>
      )}
    </div>
  );
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}
