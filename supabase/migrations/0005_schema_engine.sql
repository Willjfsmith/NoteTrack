-- NoteTrack — schema engine (Prompts 1 + 2 + 3 + 4 of generic-item-model batch 1).
--
-- Replaces hardcoded item kinds, entry types, statuses and the single global
-- pipeline with project-defined `item_types`, `entry_types`, `field_defs`, and
-- a multi-pipeline model. Specialised tables that mirrored entry types
-- (risks, decisions, gate_moves, meetings, meeting_attendees) collapse into
-- `entries.props` jsonb. The thin `actions` table survives because the
-- assigned/due query patterns are hot.
--
-- This migration is idempotent: every step is guarded by `if not exists` /
-- `if exists`. Re-running it after it has already applied is a no-op except
-- for the SP-2 reseed at the bottom (which deletes and recreates).

-- ===== 1. NEW TABLES ================================================

create table if not exists public.item_types (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  key         text not null,
  name        text not null,
  ref_prefix  text not null default '',
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, key)
);
create index if not exists item_types_project_idx on public.item_types (project_id, sort_order);

create table if not exists public.entry_types (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  key               text not null,
  name              text not null,
  color             text,
  slash_aliases     text[] not null default '{}',
  default_register  boolean not null default false,
  -- system flags survive renames so server code can find the canonical
  -- "action" / "meeting" / "gate" types regardless of project labelling.
  is_system_action  boolean not null default false,
  is_system_meeting boolean not null default false,
  is_system_gate    boolean not null default false,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, key)
);
create index if not exists entry_types_project_idx on public.entry_types (project_id, sort_order);

create table if not exists public.field_defs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  scope         text not null check (scope in ('item_type','entry_type','project')),
  scope_id      uuid,
  key           text not null,
  label         text not null,
  kind          text not null check (kind in (
                  'text','longtext','number','money','date','person',
                  'single_select','multi_select','ref_item','ref_url','bool')),
  options_jsonb jsonb not null default '[]'::jsonb,
  required      boolean not null default false,
  default_jsonb jsonb,
  helptext      text,
  show_in_header boolean not null default false,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, scope, scope_id, key)
);
create index if not exists field_defs_scope_idx on public.field_defs (project_id, scope, scope_id, sort_order);

-- ===== 2. PIPELINES — multi, type-attached =========================

alter table public.pipelines
  add column if not exists applies_to_type_id uuid references public.item_types(id) on delete cascade;

-- ===== 3. ITEMS / ENTRIES — props + type FK =======================

alter table public.items
  add column if not exists type_id uuid references public.item_types(id) on delete restrict,
  add column if not exists props   jsonb not null default '{}'::jsonb;

alter table public.entries
  add column if not exists entry_type_id uuid references public.entry_types(id) on delete restrict,
  add column if not exists props         jsonb not null default '{}'::jsonb;

-- entries.source_meeting_id currently references meetings(entry_id). After we
-- collapse the meetings table the FK target disappears, so swap it for an
-- entries(id) self-FK now (still on delete set null).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'entries_source_meeting_fk'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries drop constraint entries_source_meeting_fk;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_source_meeting_entry_fk'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_source_meeting_entry_fk
      foreign key (source_meeting_id) references public.entries(id) on delete set null;
  end if;
end $$;

-- ===== 4. BACKFILL: item_types ===================================

-- One item_types row per (project, distinct items.kind) pair, but only if
-- items.kind still exists (i.e. we haven't already migrated).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'kind'
  ) then
    insert into public.item_types (project_id, key, name, ref_prefix, sort_order)
    select distinct
      i.project_id,
      i.kind,
      initcap(replace(i.kind, '_', ' ')),
      case i.kind
        when 'equipment' then 'EQ-'
        when 'document'  then 'DOC-'
        when 'area'      then 'A-'
        else ''
      end,
      case i.kind
        when 'equipment' then 1
        when 'document'  then 2
        when 'area'      then 3
        else 9
      end
    from public.items i
    on conflict (project_id, key) do nothing;

    update public.items it
       set type_id = t.id
      from public.item_types t
     where t.project_id = it.project_id
       and t.key = it.kind
       and it.type_id is null;
  end if;
end $$;

-- ===== 5. BACKFILL: entry_types =================================

-- Seed the seven system entry types for every project.
insert into public.entry_types
  (project_id, key, name, color, slash_aliases, default_register,
   is_system_action, is_system_meeting, is_system_gate, sort_order)
select p.id, t.key, t.name, t.color, t.slash_aliases, t.default_register,
       t.is_system_action, t.is_system_meeting, t.is_system_gate, t.sort_order
from public.projects p
cross join (values
  ('note',     'Note',     'grey',   array['note']::text[],                false, false, false, false, 1),
  ('action',   'Action',   'blue',   array['todo','action','done']::text[], true,  true,  false, false, 2),
  ('decision', 'Decision', 'purple', array['decision']::text[],             true,  false, false, false, 3),
  ('risk',     'Risk',     'red',    array['risk']::text[],                 true,  false, false, false, 4),
  ('gate',     'Gate',     'green',  array[]::text[],                       false, false, false, true,  5),
  ('meeting',  'Meeting',  'yellow', array[]::text[],                       false, false, true,  false, 6),
  ('call',     'Call',     'orange', array['call']::text[],                 false, false, false, false, 7)
) as t(key, name, color, slash_aliases, default_register,
       is_system_action, is_system_meeting, is_system_gate, sort_order)
on conflict (project_id, key) do nothing;

-- Map entries.type → entry_types row for the same project.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'type'
  ) then
    update public.entries e
       set entry_type_id = et.id
      from public.entry_types et
     where et.project_id = e.project_id
       and et.key = e.type
       and e.entry_type_id is null;
  end if;
end $$;

-- ===== 6. COLLAPSE: risks → entries.props ========================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'risks'
  ) then
    update public.entries e
       set props = e.props || jsonb_strip_nulls(jsonb_build_object(
             'probability',     r.probability,
             'impact',           r.impact,
             'status',           r.status,
             'owner_person_id',  r.owner_person_id::text
           ))
      from public.risks r
     where r.entry_id = e.id;
  end if;
end $$;

-- ===== 7. COLLAPSE: decisions → entries.props ====================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'decisions'
  ) then
    update public.entries e
       set props = e.props || jsonb_strip_nulls(jsonb_build_object(
             'status',       d.status,
             'impact_text',  d.impact_text
           ))
      from public.decisions d
     where d.entry_id = e.id;
  end if;
end $$;

-- ===== 8. COLLAPSE: gate_moves → entries.props ===================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gate_moves'
  ) then
    update public.entries e
       set props = e.props || jsonb_strip_nulls(jsonb_build_object(
             'item_id',        gm.item_id::text,
             'from_stage_id',  gm.from_stage_id::text,
             'to_stage_id',    gm.to_stage_id::text
           ))
      from public.gate_moves gm
     where gm.entry_id = e.id;
  end if;
end $$;

-- ===== 9. COLLAPSE: meetings + meeting_attendees → entries.props =

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'meetings'
  ) then
    update public.entries e
       set props = e.props || jsonb_strip_nulls(jsonb_build_object(
             'series',        m.series,
             'location',      m.location,
             'started_at',    m.started_at,
             'ended_at',      m.ended_at,
             'recording_url', m.recording_url
           ))
      from public.meetings m
     where m.entry_id = e.id;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'meeting_attendees'
  ) then
    update public.entries e
       set props = e.props || jsonb_build_object('attendees', coalesce(att.ids, '[]'::jsonb))
      from (
        select meeting_id, jsonb_agg(person_id::text) as ids
        from public.meeting_attendees
        group by meeting_id
      ) att
     where att.meeting_id = e.id;
  end if;
end $$;

-- ===== 10. DROP LEGACY TABLES ===================================

drop table if exists public.meeting_attendees cascade;
drop table if exists public.meetings          cascade;
drop table if exists public.gate_moves        cascade;
drop table if exists public.risks             cascade;
drop table if exists public.decisions         cascade;

-- ===== 11. ENFORCE NOT-NULL + DROP LEGACY COLUMNS ===============

-- Make items.type_id required on rows that have it (skip if any items still
-- lack a type_id, which would only happen on a totally empty database).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'kind'
  ) then
    alter table public.items drop constraint if exists items_kind_check;
    alter table public.items drop column kind;
  end if;
  -- items inserted *after* this migration must always have a type.
  if not exists (select 1 from public.items where type_id is null) then
    alter table public.items alter column type_id set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'type'
  ) then
    alter table public.entries drop column type;
  end if;
  if not exists (select 1 from public.entries where entry_type_id is null) then
    alter table public.entries alter column entry_type_id set not null;
  end if;
end $$;

-- ===== 12. NEXT REF CODE RPC ====================================

create or replace function public.next_ref_code(p_project_id uuid, p_type_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_count  int;
begin
  select ref_prefix into v_prefix
    from public.item_types
   where id = p_type_id
     and project_id = p_project_id;
  if v_prefix is null then
    raise exception 'Unknown item type % for project %', p_type_id, p_project_id
      using errcode = '22023';
  end if;

  select count(*) + 1 into v_count
    from public.items
   where project_id = p_project_id
     and type_id    = p_type_id;

  return v_prefix || lpad(v_count::text, 3, '0');
end $$;

revoke all on function public.next_ref_code(uuid, uuid) from public;
grant execute on function public.next_ref_code(uuid, uuid) to authenticated;

-- ===== 13. TOUCH TRIGGERS =======================================

drop trigger if exists item_types_touch on public.item_types;
create trigger item_types_touch before update on public.item_types
  for each row execute procedure public.touch_updated_at();

drop trigger if exists entry_types_touch on public.entry_types;
create trigger entry_types_touch before update on public.entry_types
  for each row execute procedure public.touch_updated_at();

drop trigger if exists field_defs_touch on public.field_defs;
create trigger field_defs_touch before update on public.field_defs
  for each row execute procedure public.touch_updated_at();

-- ===== 14. RLS ===================================================

alter table public.item_types  enable row level security;
alter table public.entry_types enable row level security;
alter table public.field_defs  enable row level security;

-- read: any project member; write: only project owners (per Prompt 1).
drop policy if exists item_types_read on public.item_types;
create policy item_types_read on public.item_types
  for select using (public.is_member(project_id));
drop policy if exists item_types_owner_write on public.item_types;
create policy item_types_owner_write on public.item_types
  for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));

drop policy if exists entry_types_read on public.entry_types;
create policy entry_types_read on public.entry_types
  for select using (public.is_member(project_id));
drop policy if exists entry_types_owner_write on public.entry_types;
create policy entry_types_owner_write on public.entry_types
  for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));

drop policy if exists field_defs_read on public.field_defs;
create policy field_defs_read on public.field_defs
  for select using (public.is_member(project_id));
drop policy if exists field_defs_owner_write on public.field_defs;
create policy field_defs_owner_write on public.field_defs
  for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- ===== 15. RE-SEED SP-2 VIA THE ENGINE ==========================

-- Idempotent: drops and recreates SP-2 every run. Mirrors the legacy seed in
-- 0002_seed.sql but now demonstrates the engine end-to-end. SAG-mill is now
-- modelled as type=major_equipment with props for owner / discipline / area /
-- cost_forecast / status, satisfying Prompt 1's done-when.
delete from public.projects where code = 'SP-2';

with new_project as (
  insert into public.projects (code, name, phase, color, budget_total, budget_spent, fel3_due_at)
  values ('SP-2', 'South Plant — Phase 2', 'Detail design', 'yellow', 8200000, 3400000, current_date + 38)
  returning id
),
ppl as (
  insert into public.people (project_id, short_id, name, initials, color, role_label)
  select (select id from new_project), s.short_id, s.name, s.initials, s.color, s.role
  from (values
    ('sk','Sarah K.','SK','purple','Process eng.'),
    ('mr','Marc R.','MR','green','Mech. lead'),
    ('jt','Jules T.','JT','pink','Project mgr'),
    ('dn','Diane N.','DN','orange','EPCM rep'),
    ('pv','Pavel V.','PV','yellow','Vendor — Outotec'),
    ('ai','Aisha I.','AI','red','Civil/struct'),
    ('lr','Leo R.','LR','blue','Instr/control')
  ) as s(short_id, name, initials, color, role)
  returning id, short_id
),
itypes as (
  insert into public.item_types (project_id, key, name, ref_prefix, sort_order)
  select (select id from new_project), t.key, t.name, t.ref_prefix, t.sort_order
  from (values
    ('major_equipment', 'Major equipment', 'EQ-',  1),
    ('drawing',         'Drawing',         'DRW-', 2),
    ('area',            'Area',            'A-',   3),
    ('other',           'Other',           '',     9)
  ) as t(key, name, ref_prefix, sort_order)
  returning id, key
),
etypes as (
  insert into public.entry_types
    (project_id, key, name, color, slash_aliases, default_register,
     is_system_action, is_system_meeting, is_system_gate, sort_order)
  select (select id from new_project), t.key, t.name, t.color, t.slash_aliases,
         t.default_register, t.is_system_action, t.is_system_meeting,
         t.is_system_gate, t.sort_order
  from (values
    ('note',     'Note',     'grey',   array['note']::text[],                false, false, false, false, 1),
    ('action',   'Action',   'blue',   array['todo','action','done']::text[], true,  true,  false, false, 2),
    ('decision', 'Decision', 'purple', array['decision']::text[],             true,  false, false, false, 3),
    ('risk',     'Risk',     'red',    array['risk']::text[],                 true,  false, false, false, 4),
    ('gate',     'Gate',     'green',  array[]::text[],                       false, false, false, true,  5),
    ('meeting',  'Meeting',  'yellow', array[]::text[],                       false, false, true,  false, 6),
    ('call',     'Call',     'orange', array['call']::text[],                 false, false, false, false, 7)
  ) as t(key, name, color, slash_aliases, default_register,
         is_system_action, is_system_meeting, is_system_gate, sort_order)
  returning id, key
),
field_defs_seed as (
  insert into public.field_defs
    (project_id, scope, scope_id, key, label, kind, options_jsonb,
     show_in_header, sort_order)
  select
    (select id from new_project),
    'item_type',
    (select id from itypes where key = 'major_equipment'),
    f.key, f.label, f.kind, f.options_jsonb, f.show_in_header, f.sort_order
  from (values
    ('owner',          'Owner',         'person',        '[]'::jsonb, true,  1),
    ('discipline',     'Discipline',    'single_select',
       '[{"key":"mech","label":"Mechanical","color":"green"},
         {"key":"elec","label":"Electrical","color":"yellow"},
         {"key":"civil","label":"Civil","color":"red"},
         {"key":"inst","label":"Instr/control","color":"blue"},
         {"key":"process","label":"Process","color":"purple"}]'::jsonb,
       true, 2),
    ('area',           'Area',          'text',          '[]'::jsonb, true,  3),
    ('cost_forecast',  'Cost forecast', 'money',         '[]'::jsonb, true,  4),
    ('status',         'Status',        'single_select',
       '[{"key":"on_track","label":"On track","color":"green"},
         {"key":"at_risk","label":"At risk","color":"red","terminal":false},
         {"key":"review","label":"In review","color":"yellow"},
         {"key":"fat_pass","label":"FAT pass","color":"blue","terminal":true}]'::jsonb,
       true, 5)
  ) as f(key, label, kind, options_jsonb, show_in_header, sort_order)
  returning id
),
pipe as (
  insert into public.pipelines (project_id, name, is_default, applies_to_type_id)
  select (select id from new_project), 'Default', true,
         (select id from itypes where key = 'major_equipment')
  returning id
),
stages as (
  insert into public.pipeline_stages (pipeline_id, name, sort_order)
  select (select id from pipe), s.name, s.sort_order
  from (values
    ('Concept',     1),
    ('Design',      2),
    ('Procurement', 3),
    ('Fabrication', 4),
    ('FAT',         5),
    ('Shipping',    6),
    ('Install',     7),
    ('Commission',  8)
  ) as s(name, sort_order)
  returning id, name
)
insert into public.items (project_id, ref_code, title, type_id, current_stage_id, props)
select
  (select id from new_project),
  i.ref_code,
  i.title,
  (select id from itypes where key = i.type_key),
  (select id from stages where name = i.stage),
  i.props
from (values
  ('SAG-mill',  'SAG mill',                 'major_equipment', 'Design',
     '{"owner":"sk","discipline":"mech","area":"South mill","cost_forecast":48000000,"status":"at_risk"}'::jsonb),
  ('CV-203',    'CV-203 conveyor',          'major_equipment', 'Fabrication',
     '{"owner":"mr","discipline":"mech","area":"Conveyor gallery","cost_forecast":1200000,"status":"on_track"}'::jsonb),
  ('PMP-101',   'PMP-101 pump skid',        'major_equipment', 'Shipping',
     '{"owner":"mr","discipline":"mech","area":"Pump house","cost_forecast":420000,"status":"on_track"}'::jsonb),
  ('SWG-401',   'HV switchgear',            'major_equipment', 'Procurement',
     '{"owner":"lr","discipline":"elec","area":"Substation","cost_forecast":2200000,"status":"at_risk"}'::jsonb),
  ('TNK-12',    'Tank #12',                 'major_equipment', 'Procurement',
     '{"owner":"sk","discipline":"process","area":"Tank farm","cost_forecast":380000,"status":"review"}'::jsonb),
  ('CIV-013',   'CIV-013 plinth drawing',   'drawing',         'Design',         '{}'::jsonb),
  ('CIV-014',   'CIV-014 rebar drawing',    'drawing',         'Design',         '{}'::jsonb),
  ('PID-D',     'P&ID rev D',               'drawing',         'Design',         '{}'::jsonb),
  ('ENV-AQ-3',  'Air quality assessment',   'drawing',         'Design',         '{}'::jsonb),
  ('ELE-310',   'Electrical room',          'area',            'Design',         '{}'::jsonb)
) as i(ref_code, title, type_key, stage, props);

-- 0005 ends. Items / entries inserted from this point onwards must use the
-- engine: items get type_id, entries get entry_type_id.
