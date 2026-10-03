-- ===== Sync step 0: park the v0.1 schema =============================
-- v0.1 used projects as the container (projects, people, items, pipelines…).
-- v0.2 reuses some of those table names with different columns. Nothing is
-- dropped: the old tables are moved into a `legacy` schema, which the API does
-- not expose, so the data stays queryable from the SQL editor.
do $$
declare
  t text;
  old_tables text[] := array[
    'watches','comments','subtasks','meeting_attendees','meetings','gate_moves',
    'risks','decisions','actions','entry_refs','attachments','entries','items',
    'pipeline_stages','pipelines','people','memberships','projects'
  ];
  is_v01 boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memberships' and column_name = 'project_id'
  ) into is_v01;

  if not is_v01 then
    raise notice 'sync: no v0.1 schema found, nothing to park';
    return;
  end if;

  raise notice 'sync: v0.1 schema found — moving it to schema "legacy"';
  create schema if not exists legacy;

  foreach t in array old_tables loop
    if to_regclass('public.' || t) is not null then
      -- leave the realtime publication, if it was ever added
      begin
        execute format('alter publication supabase_realtime drop table public.%I', t);
      exception when others then null;
      end;
      execute format('alter table public.%I set schema legacy', t);
    end if;
  end loop;

  -- v0.1 RPC that only makes sense with the old tables
  drop function if exists public.create_project(text, text);

  -- v0.1 RLS helpers took (pid uuid); v0.2 redefines them as (wid uuid), and
  -- Postgres will not rename a parameter in place. Dropping them also drops the
  -- policies on the parked legacy tables, which is wanted: with RLS still on
  -- and no policies, legacy data is reachable only from the SQL editor.
  drop function if exists public.is_member(uuid) cascade;
  drop function if exists public.is_editor(uuid) cascade;
  drop function if exists public.is_owner(uuid) cascade;
end $$;
