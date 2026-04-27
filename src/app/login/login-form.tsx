"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      params.get("redirect") || "/select-project",
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-8 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">NoteTrack</p>
      <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-ink-3">We&apos;ll email you a magic link. No passwords.</p>

      {status === "sent" ? (
        <div className="mt-6 rounded-3 border border-line bg-tone-green-bg p-4 text-tone-green-ink">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-[12.5px]">
            Sent a sign-in link to <b>{email}</b>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-3 border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent-bd focus:shadow-ring"
          />
          <Button variant="primary" size="lg" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a link"}
          </Button>
          {error && <p className="text-tone-red-ink text-[12px]">{error}</p>}
        </form>
      )}
    </main>
  );
}
