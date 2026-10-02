import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center px-6">
      <p className="label">404</p>
      <h1 className="mt-1 text-[22px] font-semibold">Not found.</h1>
      <Link href="/w" className="mt-3 text-accent hover:underline">
        Back to your workspaces
      </Link>
    </main>
  );
}
