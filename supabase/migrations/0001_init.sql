-- NoteTrack — initial schema
-- Multi-project workspace; per-project membership controls RLS.

create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- ===== PROJECTS =====================================================
create table public.projects (
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

create table public.memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on public.memberships (user_id);

-- ===== PEOPLE (project-scoped contacts; may or may not be auth users) =
create table public.people (
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
create index on public.people (project_id);

-- ===== ITEMS (referenced objects: equipment / docs / areas) ==========
create table public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  is_default boolean default false,
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null,
  created_at  timestamptz not null default now()
);
create index on public.pipeline_stages (pipeline_id, sort_order);

create table public.items (
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
create index on public.items using gin (title gin_trgm_ops);

-- ===== ENTRIES (the universal event log) =============================
create table public.entries (
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
create index on public.entries (project_id, occurred_at desc);
create index on public.entries using gin (search_tsv);
create index on public.entries (source_meeting_id);

-- ===== TYPE-SPECIFIC ROWS ============================================
create table public.actions (
  entry_id             uuid primary key references public.entries(id) on delete cascade,
  owner_person_id      uuid references public.people(id) on delete set null,
  requester_person_id  uuid references public.people(id) on delete set null,
  due_at               timestamptz,
  status               text not null default 'open'
                       check (status in ('open','in_progress','done','snoozed','blocked')),
  done_at              timestamptz
);
create index on public.actions (owner_person_id, status);
create index on public.actions (due_at);

create table public.decisions (
  entry_id    uuid primary key references public.entries(id) on delete cascade,
  impact_text text,
  status      text not null default 'proposed'
              check (status in ('proposed','approved','rejected'))
);

create table public.risks (
  entry_id        uuid primary key references public.entries(id) on delete cascade,
  probability     smallint not null check (probability between 1 and 5),
  impact          smallint not null check (impact between 1 and 5),
  owner_person_id uuid references public.people(id) on delete set null,
  status          text not null default 'open'
                  check (status in ('open','mitigating','closed'))
);

create table public.gate_moves (
  entry_id      uuid primary key references public.entries(id) on delete cascade,
  item_id       uuid not null references public.items(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id) on delete set null,
  to_stage_id   uuid not null references public.pipeline_stages(id) on delete cascade
);
create index on public.gate_moves (item_id);

create table public.meetings (
  entry_id      uuid primary key references public.entries(id) on delete cascade,
  series        text,
  location      text,
  started_at    timestamptz,
  ended_at      timestamptz,
  recording_url text
);

create table public.meeting_attendees (
  meeting_id uuid not null references public.meetings(entry_id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  primary key (meeting_id, person_id)
);

-- now that meetings table exists, add the FK from entries.source_meeting_id
alter table public.entries
  add constraint entries_source_meeting_fk
  foreign key (source_meeting_id) references public.meetings(entry_id) on delete set null;

-- ===== SUPPORT: subtasks / refs / attachments / comments / watches ===
create table public.subtasks (
  id              uuid primary key default gen_random_uuid(),
  action_entry_id uuid not null references public.actions(entry_id) on delete cascade,
  title           text not null,
  done            boolean not null default false,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.subtasks (action_entry_id, sort_order);

create table public.entry_refs (
  entry_id  uuid not null references public.entries(id) on delete cascade,
  ref_kind  text not null check (ref_kind in ('item','person','file')),
  ref_id    uuid not null,
  primary key (entry_id, ref_kind, ref_id)
);
create index on public.entry_refs (ref_kind, ref_id);

create table public.attachments (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid references public.entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  mime      text,
  bytes     bigint,
  created_at timestamptz not null default now()
);
create index on public.attachments (project_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body_md    text not null,
  created_at timestamptz not null default now()
);
create index on public.comments (entry_id, created_at);

create table public.watches (
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

create trigger projects_touch before update on public.projects
  for each row execute procedure public.touch_updated_at();
create trigger items_touch before update on public.items
  for each row execute procedure public.touch_updated_at();
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

-- ----- projects: members can read; only owners can update/delete -----
create policy projects_read on public.projects
  for select using (public.is_member(id));
create policy projects_owner_update on public.projects
  for update using (
    exists(select 1 from public.memberships m
      where m.project_id = id and m.user_id = auth.uid() and m.role = 'owner'));

-- ----- memberships: a user can see their own memberships, owners manage -----
create policy memberships_self_read on public.memberships
  for select using (user_id = auth.uid() or public.is_member(project_id));
create policy memberships_owner_write on public.memberships
  for all using (
    exists(select 1 from public.memberships m
      where m.project_id = memberships.project_id and m.user_id = auth.uid() and m.role = 'owner')
  ) with check (true);

-- ----- generic per-project tables (members read; editors write) -----
do $$
declare
  t text;
  per_project text[] := array[
    'people','pipelines','items','entries',
    'attachments'
  ];
begin
  foreach t in array per_project loop
    execute format('create policy %1$s_read on public.%1$s for select using (public.is_member(project_id))', t);
    execute format('create policy %1$s_write on public.%1$s for insert with check (public.is_editor(project_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.is_editor(project_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.is_editor(project_id))', t);
  end loop;
end $$;

-- ----- pipeline_stages: no direct project_id; join through pipelines -----
create policy pipeline_stages_read on public.pipeline_stages
  for select using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_member(pl.project_id)));
create policy pipeline_stages_write on public.pipeline_stages
  for insert with check (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));
create policy pipeline_stages_update on public.pipeline_stages
  for update using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));
create policy pipeline_stages_delete on public.pipeline_stages
  for delete using (
    exists(select 1 from public.pipelines pl
      where pl.id = pipeline_stages.pipeline_id and public.is_editor(pl.project_id)));

-- ----- tables linked via entry_id: gate via parent entry's project ---
create policy actions_read   on public.actions   for select using (
  exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_member(e.project_id)));
create policy actions_write  on public.actions   for all using (
  exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy decisions_read on public.decisions for select using (
  exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_member(e.project_id)));
create policy decisions_write on public.decisions for all using (
  exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy risks_read on public.risks for select using (
  exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_member(e.project_id)));
create policy risks_write on public.risks for all using (
  exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy gate_moves_read on public.gate_moves for select using (
  exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_member(e.project_id)));
create policy gate_moves_write on public.gate_moves for all using (
  exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy meetings_read on public.meetings for select using (
  exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_member(e.project_id)));
create policy meetings_write on public.meetings for all using (
  exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy meeting_attendees_read on public.meeting_attendees for select using (
  exists(select 1 from public.meetings m
    join public.entries e on e.id = m.entry_id
    where m.entry_id = meeting_attendees.meeting_id and public.is_member(e.project_id)));
create policy meeting_attendees_write on public.meeting_attendees for all using (
  exists(select 1 from public.meetings m
    join public.entries e on e.id = m.entry_id
    where m.entry_id = meeting_attendees.meeting_id and public.is_editor(e.project_id)))
  with check (true);

create policy subtasks_read on public.subtasks for select using (
  exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_member(e.project_id)));
create policy subtasks_write on public.subtasks for all using (
  exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy entry_refs_read on public.entry_refs for select using (
  exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_member(e.project_id)));
create policy entry_refs_write on public.entry_refs for all using (
  exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy comments_read on public.comments for select using (
  exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)));
create policy comments_write on public.comments for all using (
  exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)))
  with check (author_id = auth.uid());

-- ----- watches: per-user only -----
create policy watches_self on public.watches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
