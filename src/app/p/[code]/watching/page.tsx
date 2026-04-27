import { format } from "date-fns";
import Link from "next/link";
import { Eye } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WatchingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, code")
    .eq("code", code)
    .single();
  if (!project) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: watches } = await supabase
    .from("watches")
    .select("ref_kind, ref_id, created_at")
    .eq("user_id", user.id);

  const itemWatches = (watches ?? []).filter((w) => w.ref_kind === "item");
  const itemIds = itemWatches.map((w) => w.ref_id);
  const watchedSinceById = Object.fromEntries(itemWatches.map((w) => [w.ref_id, w.created_at]));

  let items: Array<{
    id: string;
    ref_code: string;
    title: string;
    kind: string;
    updated_at: string;
    unread: number;
  }> = [];

  if (itemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, ref_code, title, kind, updated_at")
      .eq("project_id", project.id)
      .in("id", itemIds);

    items = await Promise.all(
      (itemRows ?? []).map(async (it) => {
        const since = watchedSinceById[it.id];
        const { count } = await supabase
          .from("entry_refs")
          .select("entry_id, entries:entry_id!inner ( occurred_at )", {
            count: "exact",
            head: true,
          })
          .eq("ref_kind", "item")
          .eq("ref_id", it.id)
          .gt("entries.occurred_at", since ?? "1970-01-01");
        return { ...it, unread: count ?? 0 };
      }),
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <h2 className="font-serif text-[22px] font-medium tracking-tight">Watching</h2>
        <span className="rounded border border-line bg-bg-2 px-1.5 py-px font-mono text-[11px] text-ink-3">
          {items.length} items
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-4 border border-dashed border-line p-12 text-center text-ink-3">
          <Eye className="mx-auto mb-2 h-8 w-8 text-ink-4" />
          <p className="text-[14px]">You&apos;re not watching anything yet.</p>
          <p className="mt-1 text-[12.5px]">
            Open an item and click the eye to add it to your watch list.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-4 border border-line bg-surface shadow-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 border-b border-line px-3.5 py-2 last:border-b-0 hover:bg-bg-2"
            >
              <Link
                href={`/p/${project.code}/items/${it.ref_code}`}
                className="font-mono text-[11px] text-ink-3 hover:underline"
              >
                #{it.ref_code}
              </Link>
              <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{it.title}</span>
              <span className="font-mono text-[10.5px] text-ink-4">{it.kind}</span>
              {it.unread > 0 && (
                <span className="rounded-full border border-accent-bd bg-accent-bg px-2 py-0.5 font-mono text-[10.5px] text-accent">
                  {it.unread} new
                </span>
              )}
              <span className="font-mono text-[10.5px] text-ink-4">
                {format(new Date(it.updated_at), "d MMM")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
