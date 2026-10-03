import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TOKEN_RE = /(?<![A-Za-z0-9_])(#[A-Za-z][\w-]{0,63}|@[a-z0-9][a-z0-9_]{0,31})/gi;
const URL_RE = /https?:\/\/[^\s<>)]+/g;

/**
 * Render an entry body: `#REF` and `@id` become chips linking to the row page,
 * bare URLs become links, everything else is verbatim text. No lookups.
 */
export function renderBody(body: string, opts: { slug: string; className?: string }): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  const tokens = Array.from(body.matchAll(TOKEN_RE)).map((m) => ({ i: m.index ?? 0, t: m[0], kind: "ref" as const }));
  const urls = Array.from(body.matchAll(URL_RE)).map((m) => ({ i: m.index ?? 0, t: m[0], kind: "url" as const }));
  const all = [...tokens, ...urls].sort((a, b) => a.i - b.i);
  for (const m of all) {
    if (m.i < cursor) continue;
    if (m.i > cursor) out.push(body.slice(cursor, m.i));
    if (m.kind === "url") {
      out.push(
        <a key={`u-${m.i}`} href={m.t} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent-bd underline-offset-2">
          {m.t}
        </a>,
      );
    } else {
      const code = m.t.slice(1);
      out.push(
        <Link
          key={`r-${m.i}`}
          href={`/w/${opts.slug}/r/${encodeURIComponent(code)}`}
          className="rounded-1 px-0.5 font-mono text-[12px] text-ink-2 underline decoration-line-3 decoration-dotted underline-offset-2 hover:bg-accent-bg hover:text-accent hover:decoration-accent-bd"
        >
          {m.t}
        </Link>,
      );
    }
    cursor = m.i + m.t.length;
  }
  if (cursor < body.length) out.push(body.slice(cursor));
  return (
    <span className={cn("whitespace-pre-wrap text-[13px] leading-[1.5] text-ink", opts.className)}>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </span>
  );
}
