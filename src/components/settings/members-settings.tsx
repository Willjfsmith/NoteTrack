"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addMemberByEmail, removeMember } from "@/lib/members/mutations";
import { Tone } from "@/components/ui/tone";

type Member = { userId: string; role: string; name: string; ref: string; isMe: boolean };

export function MembersSettings({ workspaceId, members, isOwner }: { workspaceId: string; members: Member[]; isOwner: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [pending, start] = useTransition();
  const router = useRouter();

  function add() {
    if (!email.trim()) return;
    start(async () => {
      const res = await addMemberByEmail({ workspaceId, email: email.trim(), role });
      if (!res.ok) { toast.error(res.error); return; }
      setEmail("");
      toast.success("Member added");
      router.refresh();
    });
  }
  function remove(userId: string) {
    if (!window.confirm("Remove this member?")) return;
    start(async () => {
      const res = await removeMember({ workspaceId, userId });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }

  return (
    <section>
      <p className="label mb-1.5">Members</p>
      <div className="divide-y divide-line rounded-3 border border-line bg-surface">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate">{m.name}{m.isMe && <span className="text-ink-4"> (you)</span>}</span>
            {m.ref && <span className="chip">@{m.ref}</span>}
            <Tone>{m.role}</Tone>
            {isOwner && !m.isMe && <button onClick={() => remove(m.userId)} className="text-[11px] text-ink-4 hover:text-tone-red-ink">remove</button>}
          </div>
        ))}
      </div>
      {isOwner && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-2 rounded-3 border border-dashed border-line p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" className="field-sm flex-1" />
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="field-sm">
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
            <button type="submit" disabled={pending || !email.trim()} className="rounded-2 border border-ink bg-ink px-2 py-0.5 text-[11.5px] text-white disabled:opacity-40">Add</button>
          </div>
          <p className="mt-1 text-[11px] text-ink-4">They must have signed in to NoteTrack once already. Nothing is emailed.</p>
        </form>
      )}
    </section>
  );
}
