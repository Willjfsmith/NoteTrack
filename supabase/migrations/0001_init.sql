-- NoteTrack v0.2 — schema
--
-- Model: a WORKSPACE (a department) holds TABLES. A table is a named set of
-- ROWS with typed PROPERTIES. The DIARY is a stream of ENTRIES; an entry can
-- reference any row (entry_refs). Actions, Decisions, Risks, Meetings, People
-- and Projects are tables like any other, but with a `kind` so the diary knows
-- how to write to them.
--
-- Run on a fresh Supabase project. Safe to re-run (idempotent).

create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- ===== WORKSPACES ====================================================
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- ===== TABLES / PROPERTIES / ROWS ====================================
create table if not exists public.tables (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  slug           text not null,
  name           text not null,
  kind           text not null default 'custom'
                 check (kind in ('custom','people','projects','actions','decisions','risks','meetings')),
  ref_prefix     text not null,
  next_seq       integer not null default 1,
  is_stub_target boolean not null default false,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  unique (workspace_id, slug)
);
-- one table per system kind per workspace
create unique index if not exists tables_system_kind_idx
  on public.tables (workspace_id, kind) where kind <> 'custom';

create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  table_id          uuid not null references public.tables(id) on delete cascade,
  key               text not null,
  name              text not null,
  type              text not null
                    check (type in ('text','number','select','multi_select','date','person','relation','checkbox','url')),
  options           jsonb not null default '[]'::jsonb,   -- select/multi_select: ["a","b"]
  relation_table_id uuid references public.tables(id) on delete set null,
  show_in_list      boolean not null default true,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  unique (table_id, key)
);

create table if not exists public.rows (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  table_id        uuid not null references public.tables(id) on delete cascade,
  ref_code        text not null,
  title           text not null,
  props           jsonb not null default '{}'::jsonb,
  user_id         uuid references auth.users(id) on delete set null,  -- people rows only
  source_entry_id uuid,                                               -- actions/decisions/risks created from the diary
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, ref_code)
);
create index if not exists rows_table_idx on public.rows (table_id, updated_at desc);
create index if not exists rows_title_trgm_idx on public.rows using gin (title gin_trgm_ops);
create index if not exists rows_props_idx on public.rows using gin (props);
create index if not exists rows_user_idx on public.rows (user_id) where user_id is not null;
create index if not exists rows_source_entry_idx on public.rows (source_entry_id) where source_entry_id is not null;

-- ===== ENTRIES (the diary) ===========================================
create table if not exists public.entries (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  author_id      uuid references auth.users(id) on delete set null,
  type           text not null check (type in ('note','action','decision','risk','gate','meeting','call')),
  body_md        text not null default '',
  occurred_at    timestamptz not null default now(),
  meeting_row_id uuid references public.rows(id) on delete set null,
  project_row_id uuid references public.rows(id) on delete set null,
  edited_at      timestamptz,
  struck_at      timestamptz,
  search_tsv     tsvector generated always as (to_tsvector('simple', coalesce(body_md, ''))) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists entries_ws_occurred_idx on public.entries (workspace_id, occurred_at desc);
create index if not exists entries_search_idx on public.entries using gin (search_tsv);
create index if not exists entries_meeting_idx on public.entries (meeting_row_id) where meeting_row_id is not null;
create index if not exists entries_project_idx on public.entries (project_row_id) where project_row_id is not null;

alter table public.rows
  drop constraint if exists rows_source_entry_fk;
alter table public.rows
  add constraint rows_source_entry_fk
  foreign key (source_entry_id) references public.entries(id) on delete cascade;

-- previous bodies, kept when an entry is edited
create table if not exists public.entry_revisions (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries(id) on delete cascade,
  body_md     text not null,
  replaced_at timestamptz not null default now(),
  edited_by   uuid references auth.users(id) on delete set null
);
create index if not exists entry_revisions_entry_idx on public.entry_revisions (entry_id, replaced_at desc);

-- links from an entry to any row (#refs and @mentions alike)
create table if not exists public.entry_refs (
  entry_id uuid not null references public.entries(id) on delete cascade,
  row_id   uuid not null references public.rows(id) on delete cascade,
  primary key (entry_id, row_id)
);
create index if not exists entry_refs_row_idx on public.entry_refs (row_id);

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entry_id     uuid not null references public.entries(id) on delete cascade,
  kind         text not null default 'file' check (kind in ('file','ink')),
  file_path    text not null,
  mime         text,
  bytes        bigint,
  meta         jsonb not null default '{}'::jsonb,   -- ink: { strokes_path, width, height }
  created_at   timestamptz not null default now()
);
create index if not exists attachments_entry_idx on public.attachments (entry_id);

-- ===== VIEWS (saved filters/sort/group per table) ====================
create table if not exists public.views (
  id         uuid primary key default gen_random_uuid(),
  table_id   uuid not null references public.tables(id) on delete cascade,
  name       text not null,
  layout     text not null default 'list' check (layout in ('list','board')),
  config     jsonb not null default '{}'::jsonb,  -- { filters:[{key,op,value}], sort:{key,dir}, group:key }
  pinned     boolean not null default false,      -- shown at the top of the sidebar
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.views add column if not exists pinned boolean not null default false;
create index if not exists views_table_idx on public.views (table_id, sort_order);

-- ===== TRIGGERS ======================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists rows_touch on public.rows;
create trigger rows_touch before update on public.rows
  for each row execute procedure public.touch_updated_at();

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute procedure public.touch_updated_at();

-- Assign a ref code (PREFIX-N) when none is supplied.
create or replace function public.rows_assign_ref() returns trigger
language plpgsql as $$
declare
  v_prefix text;
  v_seq integer;
begin
  if new.ref_code is null or btrim(new.ref_code) = '' then
    update public.tables
      set next_seq = next_seq + 1
      where id = new.table_id
      returning ref_prefix, next_seq - 1 into v_prefix, v_seq;
    new.ref_code := v_prefix || '-' || v_seq;
  else
    new.ref_code := btrim(new.ref_code);
  end if;
  return new;
end $$;

drop trigger if exists rows_assign_ref on public.rows;
create trigger rows_assign_ref before insert on public.rows
  for each row execute procedure public.rows_assign_ref();

-- ===== RLS HELPERS ===================================================
create or replace function public.is_member(wid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships m where m.workspace_id = wid and m.user_id = auth.uid());
$$;

create or replace function public.is_editor(wid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role in ('owner','editor'));
$$;

create or replace function public.is_owner(wid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships m
    where m.workspace_id = wid and m.user_id = auth.uid() and m.role = 'owner');
$$;

create or replace function public.table_workspace(tid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.tables where id = tid;
$$;

create or replace function public.entry_workspace(eid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.entries where id = eid;
$$;

-- ===== RLS ===========================================================
alter table public.workspaces      enable row level security;
alter table public.memberships     enable row level security;
alter table public.tables          enable row level security;
alter table public.properties      enable row level security;
alter table public.rows            enable row level security;
alter table public.entries         enable row level security;
alter table public.entry_revisions enable row level security;
alter table public.entry_refs      enable row level security;
alter table public.attachments     enable row level security;
alter table public.views           enable row level security;

drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces for select using (public.is_member(id));
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update
  using (public.is_owner(id)) with check (public.is_owner(id));

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select
  using (user_id = auth.uid() or public.is_member(workspace_id));
drop policy if exists memberships_owner_write on public.memberships;
create policy memberships_owner_write on public.memberships for all
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

-- tables with a workspace_id column: members read, editors write
drop policy if exists tables_read on public.tables;
create policy tables_read on public.tables for select using (public.is_member(workspace_id));
drop policy if exists tables_write on public.tables;
create policy tables_write on public.tables for all
  using (public.is_editor(workspace_id)) with check (public.is_editor(workspace_id));

drop policy if exists rows_read on public.rows;
create policy rows_read on public.rows for select using (public.is_member(workspace_id));
drop policy if exists rows_write on public.rows;
create policy rows_write on public.rows for all
  using (public.is_editor(workspace_id)) with check (public.is_editor(workspace_id));

drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries for select using (public.is_member(workspace_id));
drop policy if exists entries_write on public.entries;
create policy entries_write on public.entries for all
  using (public.is_editor(workspace_id)) with check (public.is_editor(workspace_id));

drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select using (public.is_member(workspace_id));
drop policy if exists attachments_write on public.attachments;
create policy attachments_write on public.attachments for all
  using (public.is_editor(workspace_id)) with check (public.is_editor(workspace_id));

-- joined through tables
drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties for select
  using (public.is_member(public.table_workspace(table_id)));
drop policy if exists properties_write on public.properties;
create policy properties_write on public.properties for all
  using (public.is_editor(public.table_workspace(table_id)))
  with check (public.is_editor(public.table_workspace(table_id)));

drop policy if exists views_read on public.views;
create policy views_read on public.views for select
  using (public.is_member(public.table_workspace(table_id)));
drop policy if exists views_write on public.views;
create policy views_write on public.views for all
  using (public.is_editor(public.table_workspace(table_id)))
  with check (public.is_editor(public.table_workspace(table_id)));

-- joined through entries
drop policy if exists entry_revisions_read on public.entry_revisions;
create policy entry_revisions_read on public.entry_revisions for select
  using (public.is_member(public.entry_workspace(entry_id)));
drop policy if exists entry_revisions_write on public.entry_revisions;
create policy entry_revisions_write on public.entry_revisions for all
  using (public.is_editor(public.entry_workspace(entry_id)))
  with check (public.is_editor(public.entry_workspace(entry_id)));

drop policy if exists entry_refs_read on public.entry_refs;
create policy entry_refs_read on public.entry_refs for select
  using (public.is_member(public.entry_workspace(entry_id)));
drop policy if exists entry_refs_write on public.entry_refs;
create policy entry_refs_write on public.entry_refs for all
  using (public.is_editor(public.entry_workspace(entry_id)))
  with check (public.is_editor(public.entry_workspace(entry_id)));

-- ===== REALTIME ======================================================
-- Add the diary tables to the realtime publication so open pages refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.entries;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.rows;
    exception when duplicate_object then null; end;
  end if;
end $$;
