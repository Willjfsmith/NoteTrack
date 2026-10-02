-- NoteTrack v0.2 — RPCs
--   create_workspace(name, slug, with_sample)  → seeds system tables, properties, views, your People row
--   add_member_by_email(workspace_id, email, role) → adds an existing user as a member
--   search_workspace(workspace_id, q) → full-text search across entries and rows
-- All are security definer because the caller may not yet have a membership row.

-- ---------------------------------------------------------------------
-- helper: insert a property
create or replace function public._add_property(
  p_table uuid, p_key text, p_name text, p_type text,
  p_options jsonb default '[]'::jsonb, p_relation uuid default null, p_sort int default 0
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.properties (table_id, key, name, type, options, relation_table_id, sort_order)
  values (p_table, p_key, p_name, p_type, p_options, p_relation, p_sort)
  on conflict (table_id, key) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- helper: create the system tables for a workspace
create or replace function public._seed_system_tables(p_ws uuid) returns void
language plpgsql as $$
declare
  t_projects uuid; t_people uuid; t_actions uuid; t_decisions uuid; t_risks uuid;
  t_meetings uuid; t_items uuid; t_stake uuid;
begin
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'projects', 'Projects', 'projects', 'PRJ', 1) returning id into t_projects;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'people', 'People', 'people', 'PPL', 2) returning id into t_people;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order, is_stub_target)
  values (p_ws, 'items', 'Items', 'custom', 'ITM', 3, true) returning id into t_items;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'actions', 'Actions', 'actions', 'ACT', 4) returning id into t_actions;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'decisions', 'Decisions', 'decisions', 'DEC', 5) returning id into t_decisions;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'risks', 'Risks', 'risks', 'RSK', 6) returning id into t_risks;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'meetings', 'Meetings', 'meetings', 'MTG', 7) returning id into t_meetings;
  insert into public.tables (workspace_id, slug, name, kind, ref_prefix, sort_order)
  values (p_ws, 'stakeholders', 'Stakeholders', 'custom', 'STK', 8) returning id into t_stake;

  -- Projects
  perform public._add_property(t_projects, 'status', 'Status', 'select', '["active","on hold","closed"]', null, 1);
  perform public._add_property(t_projects, 'phase', 'Phase', 'text', '[]', null, 2);
  perform public._add_property(t_projects, 'client', 'Client', 'text', '[]', null, 3);
  perform public._add_property(t_projects, 'lead', 'Lead', 'person', '[]', null, 4);

  -- People
  perform public._add_property(t_people, 'role', 'Role', 'text', '[]', null, 1);
  perform public._add_property(t_people, 'org', 'Organisation', 'text', '[]', null, 2);
  perform public._add_property(t_people, 'email', 'Email', 'text', '[]', null, 3);

  -- Items (default stub target for unknown #refs)
  perform public._add_property(t_items, 'kind', 'Kind', 'select', '["equipment","document","area","other"]', null, 1);
  perform public._add_property(t_items, 'stage', 'Stage', 'select',
    '["Concept","Design","Procurement","Fabrication","FAT","Shipping","Install","Commission"]', null, 2);
  perform public._add_property(t_items, 'owner', 'Owner', 'person', '[]', null, 3);
  perform public._add_property(t_items, 'project', 'Project', 'relation', '[]', t_projects, 4);

  -- Actions (written by /todo /action /done)
  perform public._add_property(t_actions, 'status', 'Status', 'select', '["open","in progress","blocked","done"]', null, 1);
  perform public._add_property(t_actions, 'owner', 'Owner', 'person', '[]', null, 2);
  perform public._add_property(t_actions, 'due', 'Due', 'date', '[]', null, 3);
  perform public._add_property(t_actions, 'project', 'Project', 'relation', '[]', t_projects, 4);

  -- Decisions (written by /decision)
  perform public._add_property(t_decisions, 'status', 'Status', 'select', '["proposed","approved","rejected"]', null, 1);
  perform public._add_property(t_decisions, 'decided_by', 'Decided by', 'person', '[]', null, 2);
  perform public._add_property(t_decisions, 'project', 'Project', 'relation', '[]', t_projects, 3);

  -- Risks (written by /risk)
  perform public._add_property(t_risks, 'probability', 'Probability', 'number', '[]', null, 1);
  perform public._add_property(t_risks, 'impact', 'Impact', 'number', '[]', null, 2);
  perform public._add_property(t_risks, 'status', 'Status', 'select', '["open","mitigating","closed"]', null, 3);
  perform public._add_property(t_risks, 'owner', 'Owner', 'person', '[]', null, 4);
  perform public._add_property(t_risks, 'project', 'Project', 'relation', '[]', t_projects, 5);

  -- Meetings
  perform public._add_property(t_meetings, 'date', 'Date', 'date', '[]', null, 1);
  perform public._add_property(t_meetings, 'status', 'Status', 'select', '["live","ended"]', null, 2);
  perform public._add_property(t_meetings, 'project', 'Project', 'relation', '[]', t_projects, 3);

  -- Stakeholders
  perform public._add_property(t_stake, 'org', 'Organisation', 'text', '[]', null, 1);
  perform public._add_property(t_stake, 'role', 'Role', 'text', '[]', null, 2);
  perform public._add_property(t_stake, 'influence', 'Influence', 'select', '["low","medium","high"]', null, 3);
  perform public._add_property(t_stake, 'project', 'Project', 'relation', '[]', t_projects, 4);

  -- Default saved views
  insert into public.views (table_id, name, layout, config, sort_order) values
    (t_actions, 'Open', 'list',
      '{"filters":[{"key":"status","op":"neq","value":"done"}],"sort":{"key":"due","dir":"asc"}}', 1),
    (t_actions, 'By status', 'board', '{"group":"status"}', 2),
    (t_items, 'By stage', 'board', '{"group":"stage"}', 1),
    (t_risks, 'Open', 'list',
      '{"filters":[{"key":"status","op":"neq","value":"closed"}],"sort":{"key":"probability","dir":"desc"}}', 1),
    (t_projects, 'Active', 'list', '{"filters":[{"key":"status","op":"eq","value":"active"}]}', 1);
end $$;

-- ---------------------------------------------------------------------
-- helper: sample content (a small engineering project) for a workspace
create or replace function public._seed_sample(p_ws uuid, p_uid uuid) returns void
language plpgsql as $$
declare
  t_projects uuid; t_people uuid; t_items uuid; t_actions uuid; t_risks uuid; t_decisions uuid; t_stake uuid;
  r_proj uuid; r_sk uuid; r_mr uuid; r_pv uuid; r_lr uuid; r_me uuid;
  r_sag uuid; r_cv uuid; r_pmp uuid; r_swg uuid; r_pid uuid;
  e uuid; a uuid;
begin
  select id into t_projects  from public.tables where workspace_id = p_ws and kind = 'projects';
  select id into t_people    from public.tables where workspace_id = p_ws and kind = 'people';
  select id into t_actions   from public.tables where workspace_id = p_ws and kind = 'actions';
  select id into t_risks     from public.tables where workspace_id = p_ws and kind = 'risks';
  select id into t_decisions from public.tables where workspace_id = p_ws and kind = 'decisions';
  select id into t_items     from public.tables where workspace_id = p_ws and slug = 'items';
  select id into t_stake     from public.tables where workspace_id = p_ws and slug = 'stakeholders';
  select id into r_me from public.rows where table_id = t_people and user_id = p_uid;

  insert into public.rows (workspace_id, table_id, ref_code, title, props)
  values (p_ws, t_projects, 'SP-2', 'South Plant — Phase 2',
    jsonb_build_object('status','active','phase','Detail design','client','Northern Minerals','lead', r_me))
  returning id into r_proj;

  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_people, 'sk', 'Sarah K.', '{"role":"Process engineer","org":"In-house"}') returning id into r_sk;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_people, 'mr', 'Marc R.', '{"role":"Mechanical lead","org":"In-house"}') returning id into r_mr;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_people, 'pv', 'Pavel V.', '{"role":"Vendor engineer","org":"Outotec"}') returning id into r_pv;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_people, 'lr', 'Leo R.', '{"role":"Instrumentation & control","org":"In-house"}') returning id into r_lr;

  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_stake, 'STK-1', 'Diane N.', jsonb_build_object('org','EPCM','role','Client representative','influence','high','project',r_proj)),
    (p_ws, t_stake, 'STK-2', 'Environmental regulator', jsonb_build_object('org','State EPA','role','Approvals','influence','high','project',r_proj));

  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_items, 'SAG-mill', 'SAG mill area', jsonb_build_object('kind','area','stage','Design','owner',r_mr,'project',r_proj)) returning id into r_sag;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_items, 'CV-203', 'CV-203 conveyor', jsonb_build_object('kind','equipment','stage','Fabrication','owner',r_mr,'project',r_proj)) returning id into r_cv;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_items, 'PMP-101', 'PMP-101 pump skid', jsonb_build_object('kind','equipment','stage','Shipping','owner',r_sk,'project',r_proj)) returning id into r_pmp;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_items, 'SWG-401', 'HV switchgear', jsonb_build_object('kind','equipment','stage','Procurement','owner',r_lr,'project',r_proj)) returning id into r_swg;
  insert into public.rows (workspace_id, table_id, ref_code, title, props) values
    (p_ws, t_items, 'PID-D', 'P&ID rev D', jsonb_build_object('kind','document','stage','Design','owner',r_pv,'project',r_proj)) returning id into r_pid;

  -- a few diary entries, oldest first
  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'note', 'Walked the SAG mill plinth pour — looks clean. #SAG-mill', now() - interval '2 days 6 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_sag);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'gate', 'Moved #CV-203 to Fabrication (from Procurement)', now() - interval '2 days 4 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_cv);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'action', 'Markup pump curves on #PMP-101 datasheet for @sk', now() - interval '1 day 5 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_pmp), (e, r_sk);
  insert into public.rows (workspace_id, table_id, title, props, source_entry_id)
  values (p_ws, t_actions, 'Markup pump curves on #PMP-101 datasheet for @sk',
    jsonb_build_object('status','open','owner',r_me,'due',to_char(now() + interval '2 days','YYYY-MM-DD'),'project',r_proj), e);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'decision', 'Switch gearbox vendor on #SAG-mill from Flender to Siemens', now() - interval '1 day 3 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_sag);
  insert into public.rows (workspace_id, table_id, title, props, source_entry_id)
  values (p_ws, t_decisions, 'Switch gearbox vendor on #SAG-mill from Flender to Siemens',
    jsonb_build_object('status','approved','decided_by',r_me,'project',r_proj), e);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'risk', 'Late delivery of HV switchgear #SWG-401 — 5 week lead time slip @lr', now() - interval '1 day 2 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_swg), (e, r_lr);
  insert into public.rows (workspace_id, table_id, title, props, source_entry_id)
  values (p_ws, t_risks, 'Late delivery of HV switchgear #SWG-401 — 5 week lead time slip @lr',
    jsonb_build_object('probability',4,'impact',4,'status','open','owner',r_lr,'project',r_proj), e);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'note', '@pv sent revised #PID-D — needs review before Friday.', now() - interval '3 hours', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_pid), (e, r_pv);

  insert into public.entries (workspace_id, author_id, type, body_md, occurred_at, project_row_id)
  values (p_ws, p_uid, 'action', 'Reply to regulator on dust assessment #SWG-401', now() - interval '1 hour', r_proj)
  returning id into e;
  insert into public.entry_refs values (e, r_swg);
  insert into public.rows (workspace_id, table_id, title, props, source_entry_id)
  values (p_ws, t_actions, 'Reply to regulator on dust assessment #SWG-401',
    jsonb_build_object('status','open','owner',r_me,'due',to_char(now(),'YYYY-MM-DD'),'project',r_proj), e);
end $$;

-- ---------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text, p_sample boolean default false)
returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
  v_slug text;
  v_email text;
  v_short text;
  t_people uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'name is required' using errcode = '22023'; end if;

  v_slug := lower(regexp_replace(coalesce(nullif(btrim(p_slug), ''), p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'ws-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6); end if;

  insert into public.workspaces (slug, name) values (v_slug, btrim(p_name)) returning * into v_ws;
  insert into public.memberships (workspace_id, user_id, role) values (v_ws.id, v_uid, 'owner');

  perform public._seed_system_tables(v_ws.id);

  -- a People row for the creator, so @me and ownership work
  select email into v_email from auth.users where id = v_uid;
  v_short := lower(regexp_replace(split_part(coalesce(v_email, 'me'), '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  if v_short = '' then v_short := 'me'; end if;
  select id into t_people from public.tables where workspace_id = v_ws.id and kind = 'people';
  insert into public.rows (workspace_id, table_id, ref_code, title, props, user_id)
  values (v_ws.id, t_people, substr(v_short, 1, 16), coalesce(v_email, 'Me'),
          jsonb_build_object('email', v_email), v_uid);

  if p_sample then perform public._seed_sample(v_ws.id, v_uid); end if;

  return v_ws;
end $$;

revoke all on function public.create_workspace(text, text, boolean) from public;
grant execute on function public.create_workspace(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Add someone who has already signed in at least once. No email is sent.
create or replace function public.add_member_by_email(p_ws uuid, p_email text, p_role text default 'editor')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  t_people uuid;
  v_short text;
begin
  if not public.is_owner(p_ws) then raise exception 'only owners can add members' using errcode = '42501'; end if;
  if p_role not in ('owner','editor','viewer') then raise exception 'bad role' using errcode = '22023'; end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No user with that email has signed in yet.' using errcode = 'P0002';
  end if;

  insert into public.memberships (workspace_id, user_id, role) values (p_ws, v_user, p_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  select id into t_people from public.tables where workspace_id = p_ws and kind = 'people';
  if not exists (select 1 from public.rows where table_id = t_people and user_id = v_user) then
    v_short := lower(regexp_replace(split_part(p_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
    if exists (select 1 from public.rows where workspace_id = p_ws and ref_code = v_short) then v_short := null; end if;
    insert into public.rows (workspace_id, table_id, ref_code, title, props, user_id)
    values (p_ws, t_people, v_short, btrim(p_email), jsonb_build_object('email', btrim(p_email)), v_user);
  end if;
  return v_user;
end $$;

revoke all on function public.add_member_by_email(uuid, text, text) from public;
grant execute on function public.add_member_by_email(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Full-text search across entries (tsvector) and rows (trigram on title/ref).
create or replace function public.search_workspace(p_ws uuid, p_q text, p_limit int default 40)
returns table (
  kind text, id uuid, ref_code text, title text, snippet text, occurred_at timestamptz, rank real
)
language sql stable security definer set search_path = public as $$
  with q as (select websearch_to_tsquery('simple', p_q) as tsq),
  ents as (
    select 'entry'::text as kind, e.id, null::text as ref_code, e.type as title,
           ts_headline('simple', e.body_md, q.tsq, 'MaxWords=24, MinWords=12, StartSel=**, StopSel=**') as snippet,
           e.occurred_at, ts_rank(e.search_tsv, q.tsq) as rank
    from public.entries e, q
    where e.workspace_id = p_ws and public.is_member(p_ws) and e.search_tsv @@ q.tsq
    order by rank desc, e.occurred_at desc
    limit p_limit
  ),
  rws as (
    select 'row'::text as kind, r.id, r.ref_code, r.title, t.name as snippet, r.updated_at as occurred_at,
           greatest(similarity(r.title, p_q), similarity(r.ref_code, p_q))::real as rank
    from public.rows r join public.tables t on t.id = r.table_id
    where r.workspace_id = p_ws and public.is_member(p_ws) and r.archived_at is null
      and (r.title ilike '%' || p_q || '%' or r.ref_code ilike '%' || p_q || '%')
    order by rank desc
    limit p_limit
  )
  select * from rws union all select * from ents;
$$;

revoke all on function public.search_workspace(uuid, text, int) from public;
grant execute on function public.search_workspace(uuid, text, int) to authenticated;
