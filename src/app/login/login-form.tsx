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
      params.get("redirect") || "/w",
    )}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else setStatus("sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <p className="label">NoteTrack</p>
      <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-ink-3">We&apos;ll email you a magic link. No passwords.</p>
      {status === "sent" ? (
        <div className="mt-5 rounded-3 border border-tone-green-bd bg-tone-green-bg p-3 text-tone-green-ink">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-0.5 text-[12.5px]">Sent a sign-in link to {email}.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-2">
          <input
            type="email"
            required
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field py-1.5"
          />
          <Button variant="primary" size="lg" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a link"}
          </Button>
          {error && <p className="text-[12px] text-tone-red-ink">{error}</p>}
        </form>
      )}
    </main>
  );
}
