"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-4 border border-tone-red-bd bg-tone-red-bg/40 p-6 text-[13px] shadow-1">
      <div className="mb-2 flex items-center gap-2 text-tone-red-ink">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="font-serif text-[18px] font-medium tracking-tight">Something went wrong.</h2>
      </div>
      <p className="text-ink-2">
        We hit an error rendering this page. Try again — and if it keeps happening,{" "}
        <a
          href="https://github.com/willjfsmith/notetrack/issues/new"
          className="text-accent underline"
          target="_blank"
          rel="noreferrer"
        >
          open an issue
        </a>{" "}
        with the details below.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-ink-4">digest: {error.digest}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-2 border border-line bg-surface px-2.5 py-1 text-[11.5px] hover:border-line-3"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
