"use client";

import { useEffect } from "react";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3 border border-tone-red-bd bg-surface p-4 text-[13px]">
      <p className="font-medium text-tone-red-ink">Something went wrong rendering this page.</p>
      {error.digest && <p className="mt-1 font-mono text-[11px] text-ink-4">digest: {error.digest}</p>}
      <button onClick={() => reset()} className="mt-3 rounded-2 border border-line bg-surface px-2.5 py-1 text-[12px] hover:border-line-3">
        Try again
      </button>
    </div>
  );
}
