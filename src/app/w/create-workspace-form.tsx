"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/lib/members/mutations";

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function CreateWorkspaceForm({ first }: { first: boolean }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const effectiveSlug = touched ? slug : deriveSlug(name);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("slug", effectiveSlug);
    startTransition(async () => {
      const res = await createWorkspace(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 rounded-3 border border-line bg-surface p-4">
      <p className="font-medium text-ink">{first ? "Create your workspace" : "New workspace"}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-3">
        A workspace is a department or a team. It holds one diary and your tables.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
        <input
          name="name"
          required
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className="field py-1.5"
        />
        <input
          name="slug_display"
          placeholder="url-name"
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(deriveSlug(e.target.value));
            setTouched(true);
          }}
          disabled={pending}
          className="field py-1.5 font-mono text-[12px]"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-2">
        <input type="checkbox" name="sample" defaultChecked={first} className="h-3.5 w-3.5" />
        Include a small sample project so the screens are not empty
      </label>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create workspace"}
        </Button>
        {error && <p className="text-[12px] text-tone-red-ink">{error}</p>}
      </div>
    </form>
  );
}
