"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ email }: { email: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createSupabaseBrowserClient().auth.signOut();
        router.replace("/login");
      }}
      className="text-[12px] text-ink-3 hover:text-ink"
      title={email}
    >
      Sign out
    </button>
  );
}
