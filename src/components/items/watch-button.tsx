"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { toggleWatch } from "@/lib/items/watches";

export function WatchButton({
  itemId,
  projectCode,
  initialWatching,
}: {
  itemId: string;
  projectCode: string;
  initialWatching: boolean;
}) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          const next = !watching;
          setWatching(next);
          const res = await toggleWatch({ itemId, projectCode });
          if (!res.ok) {
            toast.error(res.error);
            setWatching(!next);
            return;
          }
          toast.success(res.watching ? "Watching." : "Stopped watching.");
          setWatching(res.watching);
        })
      }
      disabled={pending}
      className={
        "inline-flex items-center gap-1.5 rounded-2 border px-2 py-1 text-[11.5px] " +
        (watching
          ? "border-accent-bd bg-accent-bg text-accent"
          : "border-line bg-surface text-ink-3 hover:border-line-3")
      }
    >
      {watching ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {watching ? "Watching" : "Watch"}
    </button>
  );
}
