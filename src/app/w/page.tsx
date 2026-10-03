import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Tone } from "@/components/ui/tone";
import { CreateWorkspaceForm } from "./create-workspace-form";
import { SignOutButton } from "./sign-out-button";

export default async function WorkspacesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, workspaces(id, slug, name)")
    .order("created_at", { ascending: false });
  const items = ((rows ?? []) as unknown as Array<{ role: string; workspaces: { id: string; slug: string; name: string } | null }>)
    .filter((r) => r.workspaces)
    .map((r) => ({ role: r.role, ws: r.workspaces! }));

  // One workspace: go straight in.
  if (items.length === 1) redirect(`/w/${items[0].ws.slug}/diary`);

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="label">NoteTrack</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Workspaces</h1>
        </div>
        <SignOutButton email={user.email ?? ""} />
      </div>

      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-3 border border-line bg-surface">
          {items.map(({ ws, role }) => (
            <li key={ws.id}>
              <Link
                href={`/w/${ws.slug}/diary`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-2"
              >
                <span className="flex-1 font-medium text-ink">{ws.name}</span>
                <span className="font-mono text-[11px] text-ink-4">/w/{ws.slug}</span>
                <Tone>{role}</Tone>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateWorkspaceForm first={items.length === 0} />
    </main>
  );
}
