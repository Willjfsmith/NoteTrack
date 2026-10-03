"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBox({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.replace(`${pathname}?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex items-center gap-2 rounded-3 border border-line bg-surface px-2.5 py-1.5 focus-within:border-line-3"
    >
      <Search className="h-3.5 w-3.5 text-ink-4" />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={'Search entries and rows… words, or "a phrase"'} className="flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-ink-4" />
      <button type="submit" className="rounded-2 border border-ink bg-ink px-2 py-0.5 text-[11.5px] text-white">Search</button>
    </form>
  );
}
