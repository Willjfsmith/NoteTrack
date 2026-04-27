-- NoteTrack — initial schema
-- Multi-project workspace; per-project membership controls RLS.
-- Safe to re-run: tables use `if not exists`, policies are dropped before re-create.

create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- ===== PROJECTS =====================================================
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  phase        text,
  color        text default 'yellow',
  budget_total numeric(14,2),
  budget_spent numeric(14,2) default 0,
  fel3_due_at  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists memberships_user_id_idx on public.memberships (user_id);

-- ===== PEOPLE (project-scoped contacts; may or may not be auth users) =
create table if not exists public.people (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  short_id    text not null,
  name        text not null,
  initials    text not null,
  color       text default 'grey',
  role_label  text,
  created_at  timestamptz not null default now(),
  unique (project_id, short_id)
);
create index if not exists people_project_id_idx on public.people (project_id);

-- ===== ITEMS (referenced objects: equipment / docs / areas) ==========
create table if not exists public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  is_default boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null,
  created_at  timestamptz not null default now()
);
create index if not exists pipeline_stages_pipeline_idx on public.pipeline_stages (pipeline_id, sort_order);

create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  ref_code         text not null,
  title            text not null,
  kind             text not null default 'other' check (kind in ('equipment','document','area','other')),
  current_stage_id uuid references public.pipeline_stages(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, ref_code)
);
create index if not exists items_title_trgm_idx on public.items using gin (title gin_trgm_ops);

-- ===== ENTRIES (the universal event log) =============================
create table if not exists public.entries (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  author_id         uuid references auth.users(id) on delete set null,
  type              text not null check (type in ('note','action','decision','risk','gate','meeting','call')),
  body_md           text not null default '',
  occurred_at       timestamptz not null default now(),
  source_meeting_id uuid,
  search_tsv        tsvector generated always as (to_tsvector('simple', coalesce(body_md, ''))) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists entries_project_occurred_idx on public.entries (project_id, occurred_at desc);
create index if not exists entries_search_idx on public.entries using gin (search_tsv);
create index if not exists entries_source_meeting_idx on public.entries (source_meeting_id);

-- ===== TYPE-SPECIFIC ROWS ============================================
create table if not exists public.actions (
  entry_id             uuid primary key references public.entries(id) on delete cascade,
  owner_person_id      uuid references public.people(id) on delete set null,
  requester_person_id  uuid references public.people(id) on delete set null,
  due_at               timestamptz,
  status               text not null default 'open'
                       check (status in ('open','in_progress','done','snoozed','blocked')),
  done_at              timestamptz
);
create index if not exists actions_owner_status_idx on public.actions (owner_person_id, status);
create index if not exists actions_due_at_idx on public.actions (due_at);

create table if not exists public.decisions (
  entry_id    uuid primary key references public.entries(id) on delete cascade,
  impact_text text,
  status      text not null default 'proposed'
              check (status in ('proposed','approved','rejected'))
);

create table if not exists public.risks (
  entry_id        uuid primary key references public.entries(id) on delete cascade,
  probability     smallint not null check (probability between 1 and 5),
  impact          smallint not null check (impact between 1 and 5),
  owner_person_id uuid references public.people(id) on delete set null,
  status          text not null default 'open'
                  check (status in ('open','mitigating','closed'))
);

create table if not exists public.gate_moves (
  entry_id      uuid primary key references public.entries(id) on delete cascade,
  item_id       uuid not null references public.items(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id) on delete set null,
  to_stage_id   uuid not null references public.pipeline_stages(id) on delete cascade
);
create index if not exists gate_moves_item_idx on public.gate_moves (item_id);

create table if not exists public.meetings (
  entry_id      uuid primary key references public.entries(id) on delete cascade,
  series        text,
  location      text,
  started_at    timestamptz,
  ended_at      timestamptz,
  recording_url text
);

create table if not exists public.meeting_attendees (
  meeting_id uuid not null references public.meetings(entry_id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  primary key (meeting_id, person_id)
);

-- now that meetings table exists, add the FK from entries.source_meeting_id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_source_meeting_fk'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_source_meeting_fk
      foreign key (source_meeting_id) references public.meetings(entry_id) on delete set null;
  end if;
end $$;

-- ===== SUPPORT: subtasks / refs / attachments / comments / watches ===
create table if not exists public.subtasks (
  id              uuid primary key default gen_random_uuid(),
  action_entry_id uuid not null references public.actions(entry_id) on delete cascade,
  title           text not null,
  done            boolean not null default false,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists subtasks_action_entry_idx on public.subtasks (action_entry_id, sort_order);

create table if not exists public.entry_refs (
  entry_id  uuid not null references public.entries(id) on delete cascade,
  ref_kind  text not null check (ref_kind in ('item','person','file')),
  ref_id    uuid not null,
  primary key (entry_id, ref_kind, ref_id)
);
create index if not exists entry_refs_kind_id_idx on public.entry_refs (ref_kind, ref_id);

create table if not exists public.attachments (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid references public.entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  mime      text,
  bytes     bigint,
  created_at timestamptz not null default now()
);
create index if not exists attachments_project_idx on public.attachments (project_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body_md    text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_entry_created_idx on public.comments (entry_id, created_at);

create table if not exists public.watches (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ref_kind  text not null check (ref_kind in ('item','entry')),
  ref_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, ref_kind, ref_id)
);

-- ===== updated_at triggers ==========================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute procedure public.touch_updated_at();

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute procedure public.touch_updated_at();

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute procedure public.touch_updated_at();

-- ===== RLS ==========================================================
alter table public.projects          enable row level security;
alter table public.memberships       enable row level security;
alter table public.people            enable row level security;
alter table public.pipelines         enable row level security;
alter table public.pipeline_stages   enable row level security;
alter table public.items             enable row level security;
alter table public.entries           enable row level security;
alter table public.actions           enable row level security;
alter table public.decisions         enable row level security;
alter table public.risks             enable row level security;
alter table public.gate_moves        enable row level security;
alter table public.meetings          enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.subtasks          enable row level security;
alter table public.entry_refs        enable row level security;
alter table public.attachments       enable row level security;
alter table public.comments          enable row level security;
alter table public.watches           enable row level security;

-- helper: am I a member of this project?
create or replace function public.is_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- helper: do I have editor or owner role?
create or replace function public.is_editor(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m
    where m.project_id = pid and m.user_id = auth.uid() and m.role in ('owner','editor')
  );
$$;

-- helper: am I the owner of this project?
-- security definer so policies that need to check ownership don't recursively
-- trigger memberships RLS (which would cause "infinite recursion detected").
create or replace function public.is_owner(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m
    where m.project_id = pid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ----- projects: members can read; only owners can update -----
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select using (public.is_member(id));

drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects
  for update using (public.is_owner(id)) with check (public.is_owner(id));

-- ----- memberships: a user sees their own rows + co-members; owners manage -----
drop policy if exists memberships_self_read on public.memberships;
create policy memberships_self_read on public.memberships
  for select using (user_id = auth.uid() or public.is_member(project_id));

drop policy if exists memberships_owner_write on public.memberships;
create policy memberships_owner_write on public.memberships
  for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- ----- people -----
drop policy if exists people_read on public.people;
create policy people_read on public.people
  for select using (public.is_member(project_id));
drop policy if exists people_insert on public.people;
create policy people_insert on public.people
  for insert with check (public.is_editor(project_id));
drop policy if exists people_update on public.people;
create policy people_update on public.people
  for update using (public.is_editor(project_id));
drop policy if exists people_delete on public.people;
create policy people_delete on public.people
  for delete using (public.is_editor(project_id));

-- ----- pipelines -----
drop policy if exists pipelines_read on public.pipelines;
create policy pipelines_read on public.pipelines
  for select using (public.is_member(project_id));
drop policy if exists pipelines_insert on public.pipelines;
create policy pipelines_insert on public.pipelines
  for insert with check (public.is_editor(project_id));
drop policy if exists pipelines_update on public.pipelines;
create policy pipelines_update on public.pipelines
  for update using (public.is_editor(project_id));
drop policy if exists pipelines_delete on public.pipelines;
create policy pipelines_delete on public.pipelines
  for delete using (public.is_editor(project_id));

-- ----- items -----
drop policy if exists items_read on public.items;
create policy items_read on public.items
  for select using (public.is_member(project_id));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert with check (public.is_editor(project_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update using (public.is_editor(project_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete using (public.is_editor(project_id));

-- ----- entries -----
drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries
  for select using (public.is_member(project_id));
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (public.is_editor(project_id));
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (public.is_editor(project_id));
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries
  for delete using (public.is_editor(project_id));

-- ----- attachments -----
drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments
  for select using (public.is_member(project_id));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert with check (public.is_editor(project_id));
drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments
  for update using (public.is_editor(project_id));
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
  for delete using (public.is_editor(project_id));

-- ----- pipeline_stages: no direct project_id; join through pipelines -----
drop policy if exists pipeline_stages_read on public.pipeline_stages;
create policy pipeline_stages_read on public.pipeline_stages
  for select using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_member(pl.project_id)));
drop policy if exists pipeline_stages_insert on public.pipeline_stages;
create policy pipeline_stages_insert on public.pipeline_stages
  for insert with check (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));
drop policy if exists pipeline_stages_update on public.pipeline_stages;
create policy pipeline_stages_update on public.pipeline_stages
  for update using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));
drop policy if exists pipeline_stages_delete on public.pipeline_stages;
create policy pipeline_stages_delete on public.pipeline_stages
  for delete using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));

-- ----- tables linked via entry_id: gate via parent entry's project ---
drop policy if exists actions_read on public.actions;
create policy actions_read on public.actions for select using (
  exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_member(e.project_id)));
drop policy if exists actions_write on public.actions;
create policy actions_write on public.actions for all using (
  exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists decisions_read on public.decisions;
create policy decisions_read on public.decisions for select using (
  exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_member(e.project_id)));
drop policy if exists decisions_write on public.decisions;
create policy decisions_write on public.decisions for all using (
  exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists risks_read on public.risks;
create policy risks_read on public.risks for select using (
  exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_member(e.project_id)));
drop policy if exists risks_write on public.risks;
create policy risks_write on public.risks for all using (
  exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists gate_moves_read on public.gate_moves;
create policy gate_moves_read on public.gate_moves for select using (
  exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_member(e.project_id)));
drop policy if exists gate_moves_write on public.gate_moves;
create policy gate_moves_write on public.gate_moves for all using (
  exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select using (
  exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_member(e.project_id)));
drop policy if exists meetings_write on public.meetings;
create policy meetings_write on public.meetings for all using (
  exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists meeting_attendees_read on public.meeting_attendees;
create policy meeting_attendees_read on public.meeting_attendees for select using (
  exists(select 1 from public.meetings m
    join public.entries e on e.id = m.entry_id
    where m.entry_id = meeting_attendees.meeting_id and public.is_member(e.project_id)));
drop policy if exists meeting_attendees_write on public.meeting_attendees;
create policy meeting_attendees_write on public.meeting_attendees for all using (
  exists(select 1 from public.meetings m
    join public.entries e on e.id = m.entry_id
    where m.entry_id = meeting_attendees.meeting_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists subtasks_read on public.subtasks;
create policy subtasks_read on public.subtasks for select using (
  exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_member(e.project_id)));
drop policy if exists subtasks_write on public.subtasks;
create policy subtasks_write on public.subtasks for all using (
  exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists entry_refs_read on public.entry_refs;
create policy entry_refs_read on public.entry_refs for select using (
  exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_member(e.project_id)));
drop policy if exists entry_refs_write on public.entry_refs;
create policy entry_refs_write on public.entry_refs for all using (
  exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_editor(e.project_id)))
  with check (true);

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (
  exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)));
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments for all using (
  exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)))
  with check (author_id = auth.uid());

-- ----- watches: per-user only -----
drop policy if exists watches_self on public.watches;
create policy watches_self on public.watches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
