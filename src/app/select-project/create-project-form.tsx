"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createProjectAction } from "./actions";

function deriveCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  return base || "PROJECT";
}

export function CreateProjectForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveCode = codeTouched ? code : name ? deriveCode(name) : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("code", effectiveCode);
    startTransition(async () => {
      const result = await createProjectAction(fd);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "mt-4 rounded-4 border border-line bg-surface p-4"
          : "mt-4 rounded-4 border border-line bg-surface p-5"
      }
    >
      <p className="font-medium text-ink">Create a new project</p>
      <p className="mt-1 text-[12.5px] text-ink-3">
        You&apos;ll be added as the owner. Pick a short code for URLs (e.g. <code className="rounded bg-bg-2 px-1 font-mono text-[11.5px]">SP-2</code>).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
        <input
          name="name"
          required
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className="w-full rounded-3 border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-accent-bd focus:shadow-ring"
        />
        <input
          name="code"
          placeholder="CODE"
          value={effectiveCode}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setCodeTouched(true);
          }}
          disabled={pending}
          className="w-full rounded-3 border border-line bg-bg px-3 py-2 font-mono text-[13px] uppercase tracking-wide outline-none focus:border-accent-bd focus:shadow-ring"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" size="lg" type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create project"}
        </Button>
        {error && <p className="text-[12px] text-tone-red-ink">{error}</p>}
      </div>
    </form>
  );
}
