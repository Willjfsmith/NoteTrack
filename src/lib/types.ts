/** Domain types for NoteTrack v0.2 — a workspace of tables, and a diary of entries. */

export type Role = "owner" | "editor" | "viewer";

export type Workspace = { id: string; slug: string; name: string };

export type TableKind =
  | "custom"
  | "people"
  | "projects"
  | "actions"
  | "decisions"
  | "risks"
  | "meetings";

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "person"
  | "relation"
  | "checkbox"
  | "url";

export const PROPERTY_TYPES: PropertyType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "person",
  "relation",
  "checkbox",
  "url",
];

export type PropertyDef = {
  id: string;
  table_id: string;
  key: string;
  name: string;
  type: PropertyType;
  options: string[];
  relation_table_id: string | null;
  show_in_list: boolean;
  sort_order: number;
};

export type TableDef = {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  kind: TableKind;
  ref_prefix: string;
  is_stub_target: boolean;
  sort_order: number;
  properties: PropertyDef[];
  views: ViewDef[];
};

/** A property value as stored in `rows.props`. */
export type PropValue = string | number | boolean | string[] | null;
export type Props = Record<string, PropValue>;

export type RowData = {
  id: string;
  workspace_id: string;
  table_id: string;
  ref_code: string;
  title: string;
  props: Props;
  user_id: string | null;
  source_entry_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Minimal row shape used when another row refers to this one (person / relation). */
export type RowRef = { id: string; ref_code: string; title: string; table_id: string };
export type RowLookup = Record<string, RowRef>;

export type FilterOp = "eq" | "neq" | "contains" | "empty" | "not_empty" | "gt" | "lt";
export type Filter = { key: string; op: FilterOp; value?: string | number | boolean };
export type Sort = { key: string; dir: "asc" | "desc" };
export type ViewLayout = "list" | "board";
export type ViewConfig = { filters?: Filter[]; sort?: Sort; group?: string; q?: string };

export type ViewDef = {
  id: string;
  table_id: string;
  name: string;
  layout: ViewLayout;
  config: ViewConfig;
  pinned: boolean;
  sort_order: number;
};

export type EntryType = "note" | "action" | "decision" | "risk" | "gate" | "meeting" | "call";

export type AttachmentData = {
  id: string;
  entry_id: string;
  kind: "file" | "ink";
  file_path: string;
  mime: string | null;
  bytes: number | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type EntryData = {
  id: string;
  workspace_id: string;
  author_id: string | null;
  type: EntryType;
  body_md: string;
  occurred_at: string;
  meeting_row_id: string | null;
  project_row_id: string | null;
  edited_at: string | null;
  struck_at: string | null;
  /** rows this entry references (#refs and @mentions) */
  refs: RowRef[];
  /** the Actions/Decisions/Risks row created from this entry, if any */
  linked: (RowRef & { props: Props }) | null;
  attachments: AttachmentData[];
};

export type EntryRevision = { id: string; body_md: string; replaced_at: string };

/** Pseudo-keys usable in filters/sorts alongside property keys. */
export const PSEUDO_KEYS = ["title", "ref_code", "created_at", "updated_at"] as const;
