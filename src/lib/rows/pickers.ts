import { fetchRowRefs } from "./fetch";
import { tableByKind, type WorkspaceContext } from "@/lib/workspace/context";
import type { PropertyDef, RowRef } from "@/lib/types";

export type PickerOptions = Record<string, RowRef[]>;

/** Options for every person / relation property: the rows of the target table. */
export async function buildPickers(ctx: WorkspaceContext, defs: PropertyDef[]): Promise<PickerOptions> {
  const people = tableByKind(ctx, "people");
  const out: PickerOptions = {};
  const cache = new Map<string, Promise<RowRef[]>>();
  for (const d of defs) {
    const target = d.type === "person" ? people?.id : d.type === "relation" ? d.relation_table_id : null;
    if (!target) continue;
    if (!cache.has(target)) cache.set(target, fetchRowRefs(target));
    out[d.key] = await cache.get(target)!;
  }
  return out;
}
