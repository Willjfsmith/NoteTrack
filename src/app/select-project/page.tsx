import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Tone } from "@/components/ui/tone";
import { CreateProjectForm } from "./create-project-form";

export default async function SelectProjectPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, projects(id, code, name, phase, color)")
    .order("created_at", { ascending: false });

  const projects = (rows ?? []).map((r) => ({
    role: r.role as string,
    project: (r as unknown as { projects: { id: string; code: string; name: string; phase: string | null; color: string | null } }).projects,
  })).filter((r) => r.project);

  return (
    <main className="mx-auto max-w-2xl px-8 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">NoteTrack</p>
      <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight">Choose a project</h1>

      {projects.length === 0 ? (
        <>
          <div className="mt-6 rounded-4 border border-line bg-surface p-6 text-ink-2">
            <p className="font-medium text-ink">You&apos;re not a member of any project yet.</p>
            <p className="mt-2 text-[13px]">
              Create one below to get started, or ask an owner to add you to an existing project.
            </p>
          </div>
          <CreateProjectForm />
        </>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {projects.map(({ project, role }) => (
              <li key={project.id}>
                <Link
                  href={`/p/${project.code}/today`}
                  className="flex items-center gap-3 rounded-4 border border-line bg-surface px-4 py-3 transition-colors hover:border-line-3 hover:bg-bg-2"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-tone-yellow-bd" />
                  <div className="flex-1">
                    <div className="font-medium text-ink">{project.name}</div>
                    <div className="text-[12px] text-ink-3">
                      {project.code} · {project.phase ?? "—"}
                    </div>
                  </div>
                  <Tone color="grey" square>
                    {role}
                  </Tone>
                </Link>
              </li>
            ))}
          </ul>
          <CreateProjectForm compact />
        </>
      )}
    </main>
  );
}
