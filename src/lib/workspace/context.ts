import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PropertyDef, Role, RowRef, TableDef, ViewDef, Workspace } from "@/lib/types";

export type WorkspaceContext = {
  workspace: Workspace;
  role: Role;
  userId: string;
  tables: TableDef[];
  /** the People row linked to the signed-in user, if any */
  me: RowRef | null;
};

/**
 * Everything a page needs about the current workspace, fetched once per request.
 * Returns null when the slug is unknown or the user is not a member (RLS hides it).
 */
export const getWorkspaceContext = cache(async (slug: string): Promise<WorkspaceContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!ws) return null;

  const [{ data: membership }, { data: tables }, { data: props }, { data: views }, { data: me }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("role")
        .eq("workspace_id", ws.id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("tables")
        .select("id, workspace_id, slug, name, kind, ref_prefix, is_stub_target, sort_order")
        .eq("workspace_id", ws.id)
        .order("sort_order"),
      supabase
        .from("properties")
        .select(
          "id, table_id, key, name, type, options, relation_table_id, show_in_list, sort_order, tables!inner(workspace_id)",
        )
        .eq("tables.workspace_id", ws.id)
        .order("sort_order"),
      supabase
        .from("views")
        .select("id, table_id, name, layout, config, pinned, sort_order, tables!inner(workspace_id)")
        .eq("tables.workspace_id", ws.id)
        .order("sort_order"),
      supabase
        .from("rows")
        .select("id, ref_code, title, table_id")
        .eq("workspace_id", ws.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (!membership) return null;

  const propsByTable = new Map<string, PropertyDef[]>();
  for (const p of (props ?? []) as unknown as Array<PropertyDef & { tables: unknown }>) {
    const arr = propsByTable.get(p.table_id) ?? [];
    arr.push({
      id: p.id,
      table_id: p.table_id,
      key: p.key,
      name: p.name,
      type: p.type,
      options: Array.isArray(p.options) ? (p.options as string[]) : [],
      relation_table_id: p.relation_table_id,
      show_in_list: p.show_in_list,
      sort_order: p.sort_order,
    });
    propsByTable.set(p.table_id, arr);
  }
  const viewsByTable = new Map<string, ViewDef[]>();
  for (const v of (views ?? []) as unknown as Array<ViewDef & { tables: unknown }>) {
    const arr = viewsByTable.get(v.table_id) ?? [];
    arr.push({
      id: v.id,
      table_id: v.table_id,
      name: v.name,
      layout: v.layout,
      config: (v.config ?? {}) as ViewDef["config"],
      pinned: Boolean(v.pinned),
      sort_order: v.sort_order,
    });
    viewsByTable.set(v.table_id, arr);
  }

  const tableDefs: TableDef[] = ((tables ?? []) as Array<Omit<TableDef, "properties" | "views">>).map(
    (t) => ({
      ...t,
      properties: propsByTable.get(t.id) ?? [],
      views: viewsByTable.get(t.id) ?? [],
    }),
  );

  return {
    workspace: ws as Workspace,
    role: membership.role as Role,
    userId: user.id,
    tables: tableDefs,
    me: (me as RowRef | null) ?? null,
  };
});

export function tableBySlug(ctx: WorkspaceContext, slug: string): TableDef | undefined {
  return ctx.tables.find((t) => t.slug === slug);
}
export function tableByKind(ctx: WorkspaceContext, kind: TableDef["kind"]): TableDef | undefined {
  return ctx.tables.find((t) => t.kind === kind);
}
export function tableById(ctx: WorkspaceContext, id: string): TableDef | undefined {
  return ctx.tables.find((t) => t.id === id);
}

/** URL helpers — one place to change the route shape. */
export const href = {
  diary: (slug: string) => `/w/${slug}/diary`,
  table: (slug: string, table: string, view?: string) =>
    `/w/${slug}/t/${table}${view ? `?view=${view}` : ""}`,
  row: (slug: string, ref: string) => `/w/${slug}/r/${encodeURIComponent(ref)}`,
  search: (slug: string, q?: string) => `/w/${slug}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  settings: (slug: string) => `/w/${slug}/settings`,
  export: (slug: string, params: Record<string, string>) =>
    `/w/${slug}/export?${new URLSearchParams(params).toString()}`,
};
