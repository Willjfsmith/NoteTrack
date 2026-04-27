import { format } from "date-fns";
import { FileText, Image as ImageIcon, FileBadge2, Layers } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FileUpload } from "@/components/library/file-upload";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ kind?: string; item?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("code", code)
    .single();
  if (!project) return null;

  let attQuery = supabase
    .from("attachments")
    .select(
      `
      id, file_path, mime, bytes, created_at,
      entry:entry_id ( body_md, occurred_at )
    `,
    )
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(120);

  if (sp.kind === "image") attQuery = attQuery.like("mime", "image/%");
  else if (sp.kind === "pdf") attQuery = attQuery.eq("mime", "application/pdf");
  else if (sp.kind === "dwg")
    attQuery = attQuery.in("mime", ["image/vnd.dwg", "application/acad", "application/dwg"]);

  const { data: rows } = await attQuery;

  const filters = [
    { key: "all", label: "All" },
    { key: "image", label: "Images" },
    { key: "pdf", label: "PDFs" },
    { key: "dwg", label: "DWGs" },
  ];
  const active = sp.kind ?? "all";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <h2 className="font-serif text-[22px] font-medium tracking-tight">Library</h2>
        <span className="rounded border border-line bg-bg-2 px-1.5 py-px font-mono text-[11px] text-ink-3">
          {rows?.length ?? 0} files
        </span>
        <div className="ml-2 flex gap-1.5">
          {filters.map((f) => (
            <a
              key={f.key}
              href={
                f.key === "all"
                  ? `/p/${project.code}/library`
                  : `/p/${project.code}/library?kind=${f.key}`
              }
              className={
                "rounded-full border px-2 py-0.5 text-[11px] " +
                (active === f.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-3 hover:border-line-3")
              }
            >
              {f.label}
            </a>
          ))}
        </div>
        <span className="ml-auto" />
        <FileUpload projectId={project.id} />
      </div>

      {!rows || rows.length === 0 ? (
        <div className="rounded-4 border border-dashed border-line p-12 text-center text-ink-3">
          <p className="text-[14px]">No files uploaded.</p>
          <p className="mt-1 text-[12.5px]">
            Click <b>Upload</b> to add a PDF, image, or DWG.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((r) => {
            const entry = (
              r as {
                entry:
                  | { body_md: string; occurred_at: string }
                  | { body_md: string; occurred_at: string }[]
                  | null;
              }
            ).entry;
            const e = Array.isArray(entry) ? entry[0] : entry;
            return (
              <article
                key={r.id}
                className="overflow-hidden rounded-3 border border-line bg-surface shadow-1"
              >
                <div className="grid h-28 place-items-center bg-bg-2 text-ink-3">
                  {iconForMime(r.mime)}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-[12.5px] font-medium text-ink" title={r.file_path}>
                    {basename(r.file_path)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-ink-4">
                    <span>{formatBytes(r.bytes ?? 0)}</span>
                    <span>·</span>
                    <span>{r.mime ?? "—"}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11.5px] text-ink-3">
                    {e?.body_md ?? "(no description)"}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-ink-4">
                    {format(new Date(r.created_at), "d MMM HH:mm")}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function iconForMime(mime: string | null) {
  if (!mime) return <FileBadge2 className="h-8 w-8" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-8 w-8" />;
  if (mime === "application/pdf") return <FileText className="h-8 w-8" />;
  return <Layers className="h-8 w-8" />;
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
