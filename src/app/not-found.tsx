import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">404</p>
      <h1 className="font-serif text-4xl font-medium">Not found.</h1>
      <Link href="/" className="mt-4 text-accent hover:underline">
        Back to home
      </Link>
    </main>
  );
}
