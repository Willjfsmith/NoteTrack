import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TOKEN_RE = /(?<![A-Za-z0-9_])(#[A-Za-z][\w-]{0,63}|@[a-z0-9][a-z0-9_]{0,31})/gi;

/**
 * Render an entry body, replacing #refs and @mentions with chips. Plain text
 * outside of refs is preserved verbatim. Pure presentational — no DB lookups.
 */
export function renderBody(
  body: string,
  opts: { projectCode: string; className?: string },
): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const match of body.matchAll(TOKEN_RE)) {
    const i = match.index ?? 0;
    if (i > cursor) out.push(body.slice(cursor, i));
    const tok = match[0];
    if (tok.startsWith("#")) {
      out.push(
        <Link
          key={`r-${i}`}
          href={`/p/${opts.projectCode}/items/${tok.slice(1)}`}
          className="mx-px inline-flex items-center rounded-1 border border-tone-blue-bd bg-tone-blue-bg px-1 font-mono text-[11px] text-tone-blue-ink hover:underline"
        >
          {tok}
        </Link>,
      );
    } else {
      out.push(
        <span
          key={`p-${i}`}
          className="mx-px inline-flex items-center rounded-1 border border-tone-pink-bd bg-tone-pink-bg px-1 font-mono text-[11px] text-tone-pink-ink"
        >
          {tok}
        </span>,
      );
    }
    cursor = i + tok.length;
  }
  if (cursor < body.length) out.push(body.slice(cursor));
  return (
    <span className={cn("text-[14px] leading-[1.55] text-ink", opts.className)}>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </span>
  );
}
