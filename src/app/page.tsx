import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center px-6 py-16">
      <p className="label">NoteTrack</p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-ink">
        A diary and a set of tables, cross-linked.
      </h1>
      <p className="mt-3 max-w-[56ch] text-[13.5px] leading-[1.6] text-ink-2">
        Write what happened in the diary. Track things in tables. Every entry can point at rows in
        any table, and every row shows the entries that point at it.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/login">
          <Button variant="primary" size="lg">
            Sign in
          </Button>
        </Link>
      </div>
    </main>
  );
}
