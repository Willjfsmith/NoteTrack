import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-8 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">NoteTrack</p>
      <h1 className="font-serif text-5xl font-medium leading-[1.05] tracking-tight text-ink">
        A project diary <span className="italic text-ink-3">for engineering teams.</span>
      </h1>
      <p className="mt-4 max-w-[60ch] font-serif text-[16px] leading-[1.55] text-ink-2">
        Capture notes, decisions, risks and gate moves in one stream. Cross-link items, people and
        files. See what&apos;s on you today, what&apos;s slipping, and what changed.
      </p>
      <div className="mt-8 flex gap-2">
        <Link href="/login">
          <Button variant="primary" size="lg">
            Sign in
          </Button>
        </Link>
        <Link href="/styleguide">
          <Button size="lg">Style guide</Button>
        </Link>
      </div>
    </main>
  );
}
