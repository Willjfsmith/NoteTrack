import type { ToneColor } from "@/components/ui/tone";
import type { EntryType } from "@/lib/types";

/** Entry type → chip tone. Monochrome by default; colour only where it carries meaning. */
export const TYPE_TONE: Record<EntryType, ToneColor> = {
  note: "grey",
  action: "accent",
  decision: "ink",
  risk: "red",
  call: "grey",
  gate: "green",
  meeting: "grey",
};
