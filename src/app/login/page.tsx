import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-8 py-16">
          <p className="text-ink-3">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
