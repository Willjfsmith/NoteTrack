"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createProperty, createTable, deleteProperty, deleteTable, updateProperty, updateTable } from "@/lib/tables/mutations";
import { PROPERTY_TYPES, type PropertyDef, type PropertyType, type TableDef } from "@/lib/types";
import { Tone } from "@/components/ui/tone";

const TYPE_LABEL: Record<PropertyType, string> = {
  text: "Text", number: "Number", select: "Select", multi_select: "Multi-select", date: "Date",
  person: "Person", relation: "Relation", checkbox: "Checkbox", url: "URL",
};

export function TablesSettings({ workspaceId, tables }: { workspaceId: string; tables: TableDef[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function addTable() {
    const name = newName.trim();
    const prefix = (newPrefix.trim() || name.replace(/[^A-Za-z]/g, "").slice(0, 3)).toUpperCase();
    if (!name || !prefix) return;
    start(async () => {
      const res = await createTable({ workspaceId, name, prefix });
      if (!res.ok) { toast.error(res.error); return; }
      setNewName(""); setNewPrefix("");
      setOpen(res.data.id);
      router.refresh();
    });
  }

  return (
    <section>
      <p className="label mb-1.5">Tables</p>
      <div className="divide-y divide-line rounded-3 border border-line bg-surface">
        {tables.map((t) => (
          <TableRow key={t.id} table={t} tables={tables} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); addTable(); }} className="mt-2 flex flex-wrap items-center gap-1.5 rounded-3 border border-dashed border-line p-2">
        <Plus className="h-3.5 w-3.5 text-ink-4" />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New table (e.g. Vendors)" className="field-sm w-48" />
        <input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value.toUpperCase())} placeholder="PREFIX" maxLength={8} className="field-sm w-24 font-mono uppercase" />
        <button type="submit" disabled={pending || !newName.trim()} className="rounded-2 border border-ink bg-ink px-2 py-0.5 text-[11.5px] text-white disabled:opacity-40">Add table</button>
        <span className="text-[11px] text-ink-4">Rows get refs like PREFIX-1, PREFIX-2… unless you type your own.</span>
      </form>
    </section>
  );
}

function TableRow({ table, tables, open, onToggle }: { table: TableDef; tables: TableDef[]; open: boolean; onToggle: () => void }) {
  const [name, setName] = useState(table.name);
  const [prefix, setPrefix] = useState(table.ref_prefix);
  const [pending, start] = useTransition();
  const router = useRouter();
  const system = table.kind !== "custom";

  function save() {
    start(async () => {
      const res = await updateTable({ tableId: table.id, name: name.trim(), prefix: prefix.trim() });
      if (!res.ok) toast.error(res.error); else { toast.success("Saved"); router.refresh(); }
    });
  }
  function makeStub() {
    start(async () => {
      const res = await updateTable({ tableId: table.id, isStubTarget: true });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }
  function remove() {
    if (!window.confirm(`Delete table "${table.name}" and all its rows? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteTable({ tableId: table.id });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }

  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-bg-2">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-ink-4" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-4" />}
        <span className="font-medium">{table.name}</span>
        <span className="chip">{table.ref_prefix}</span>
        {system && <Tone>{table.kind}</Tone>}
        {table.is_stub_target && <Tone color="accent">#ref default</Tone>}
        <span className="ml-auto font-mono text-[10.5px] text-ink-4">{table.properties.length} props</span>
      </button>
      {open && (
        <div className={cn("border-t border-line bg-bg-2/50 px-3 py-2.5", pending && "opacity-70")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} className="field-sm w-40" aria-label="Table name" />
            <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} maxLength={8} className="field-sm w-20 font-mono" aria-label="Ref prefix" />
            <button onClick={save} className="rounded-2 border border-line bg-surface px-2 py-0.5 text-[11.5px] hover:border-line-3">Save</button>
            {!table.is_stub_target && table.kind !== "people" && (
              <button onClick={makeStub} className="text-[11.5px] text-ink-3 hover:text-ink" title="Unknown #refs typed in the diary create rows here">make #ref default</button>
            )}
            <span className="flex-1" />
            {!system && <button onClick={remove} className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-tone-red-ink"><Trash2 className="h-3 w-3" /> delete table</button>}
          </div>
          {system && (
            <p className="mt-1.5 text-[11px] text-ink-4">
              {table.kind === "actions" && "The diary writes here on /todo /action /done. Keeps the keys status, owner, due, project."}
              {table.kind === "decisions" && "The diary writes here on /decision. Keeps the keys status, decided_by, project."}
              {table.kind === "risks" && "The diary writes here on /risk (p:N i:N). Keeps the keys probability, impact, status, owner, project."}
              {table.kind === "people" && "@mentions resolve against this table's refs. Rows linked to a sign-in show as members."}
              {table.kind === "projects" && "The diary's project filter and every table's Project relation point here."}
              {table.kind === "meetings" && "A meeting row's page has a notes composer; each line becomes a diary entry attached to the meeting."}
            </p>
          )}
          <PropertiesEditor table={table} tables={tables} />
        </div>
      )}
    </div>
  );
}

function PropertiesEditor({ table, tables }: { table: TableDef; tables: TableDef[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [options, setOptions] = useState("");
  const [relation, setRelation] = useState(tables[0]?.id ?? "");

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createProperty({
        tableId: table.id,
        name: name.trim(),
        type,
        options: type === "select" || type === "multi_select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
        relationTableId: type === "relation" ? relation : undefined,
      });
      if (!res.ok) { toast.error(res.error); return; }
      setName(""); setOptions("");
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <table className="w-full text-[12px]">
        <tbody>
          {table.properties.map((p) => (
            <PropertyRow key={p.id} prop={p} tables={tables} />
          ))}
        </tbody>
      </table>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", pending && "opacity-70")}>
        <Plus className="h-3 w-3 text-ink-4" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Property name" className="field-sm w-36" />
        <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="field-sm">
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        {(type === "select" || type === "multi_select") && (
          <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="options, comma, separated" className="field-sm w-52" />
        )}
        {type === "relation" && (
          <select value={relation} onChange={(e) => setRelation(e.target.value)} className="field-sm">
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <button type="submit" disabled={pending || !name.trim()} className="rounded-2 border border-line bg-surface px-2 py-0.5 text-[11.5px] hover:border-line-3 disabled:opacity-40">Add property</button>
      </form>
    </div>
  );
}

function PropertyRow({ prop, tables }: { prop: PropertyDef; tables: TableDef[] }) {
  const [name, setName] = useState(prop.name);
  const [options, setOptions] = useState(prop.options.join(", "));
  const [pending, start] = useTransition();
  const router = useRouter();
  const hasOptions = prop.type === "select" || prop.type === "multi_select";
  const dirty = name !== prop.name || (hasOptions && options !== prop.options.join(", "));

  function save() {
    start(async () => {
      const res = await updateProperty({ propertyId: prop.id, name: name.trim(), options: hasOptions ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }
  function toggleList() {
    start(async () => {
      const res = await updateProperty({ propertyId: prop.id, showInList: !prop.show_in_list });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }
  function remove() {
    if (!window.confirm(`Delete property "${prop.name}"? Values stay in the rows but are no longer shown.`)) return;
    start(async () => {
      const res = await deleteProperty({ propertyId: prop.id });
      if (!res.ok) toast.error(res.error); else router.refresh();
    });
  }
  return (
    <tr className={cn("border-t border-line", pending && "opacity-60")}>
      <td className="py-1 pr-2"><input value={name} onChange={(e) => setName(e.target.value)} className="field-sm w-32" /></td>
      <td className="py-1 pr-2 font-mono text-[10.5px] text-ink-4">{prop.key}</td>
      <td className="py-1 pr-2 text-ink-3">
        {TYPE_LABEL[prop.type]}
        {prop.type === "relation" && <span className="text-ink-4"> → {tables.find((t) => t.id === prop.relation_table_id)?.name ?? "?"}</span>}
      </td>
      <td className="py-1 pr-2">
        {hasOptions && <input value={options} onChange={(e) => setOptions(e.target.value)} className="field-sm w-full min-w-[160px]" placeholder="options" />}
      </td>
      <td className="py-1 pr-2 whitespace-nowrap">
        <label className="flex items-center gap-1 text-[11px] text-ink-3"><input type="checkbox" checked={prop.show_in_list} onChange={toggleList} className="h-3 w-3" /> in list</label>
      </td>
      <td className="py-1 text-right whitespace-nowrap">
        {dirty && <button onClick={save} className="mr-2 rounded-2 border border-ink bg-ink px-1.5 py-px text-[11px] text-white">Save</button>}
        <button onClick={remove} className="text-ink-4 hover:text-tone-red-ink" title="Delete property"><Trash2 className="h-3 w-3" /></button>
      </td>
    </tr>
  );
}
