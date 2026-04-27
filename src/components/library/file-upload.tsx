"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAttachment } from "@/lib/library/upload";
import { cn } from "@/lib/utils";

export function FileUpload({
  projectId,
  defaultItemRef,
  onUploaded,
  className,
}: {
  projectId: string;
  defaultItemRef?: string;
  onUploaded?: (entryId: string) => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function trigger() {
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${projectId}/${Date.now()}-${safeName}`;
      setProgress(`Uploading ${file.name}…`);
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      startTransition(async () => {
        const res = await recordAttachment({
          projectId,
          filePath: path,
          mime: file.type || null,
          bytes: file.size,
          itemRef: defaultItemRef,
        });
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(`${file.name} uploaded.`);
          onUploaded?.(res.entryId);
        }
      });
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        onClick={trigger}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-2 border border-line bg-surface px-2.5 py-1 text-[11.5px] hover:border-line-3 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {progress && <span className="text-[11px] text-ink-3">{progress}</span>}
    </div>
  );
}
