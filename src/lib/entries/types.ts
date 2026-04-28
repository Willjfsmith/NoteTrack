/** A row in the diary / activity timeline. */
export type EntryRowData = {
  id: string;
  /** Project-defined entry-type key (resolved via the entry_types join). */
  type: string;
  /** Optional human label for the entry type. */
  type_label?: string | null;
  /** Optional palette colour key from the entry type. */
  type_color?: string | null;
  body_md: string;
  occurred_at: string;
  /** Free-form per-type metadata pulled from `entries.props`. */
  props?: Record<string, unknown>;
  author?: { name: string | null; initials: string | null; color: string | null } | null;
  /** Specialised metadata for the action thin table (only present for action-typed entries). */
  action?: { status: string; due_at: string | null; owner_initials?: string | null } | null;
  /** Risk metadata sourced from `entries.props`. */
  risk?: { probability: number; impact: number; status: string } | null;
  /** Decision metadata sourced from `entries.props`. */
  decision?: { status: string } | null;
  /** Gate metadata sourced from `entries.props`. */
  gate?: { from_stage: string | null; to_stage: string | null; ref_code: string | null } | null;
};
