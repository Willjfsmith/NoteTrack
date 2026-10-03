-- Exercises the RPCs end to end as a fake signed-in user. Fails loudly if anything regresses.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'will@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'sarah@example.com');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare ws public.workspaces; n int; r text;
begin
  ws := public.create_workspace('Engineering', '', true);
  select count(*) into n from public.tables where workspace_id = ws.id;
  if n <> 8 then raise exception 'expected 8 system tables, got %', n; end if;
  select count(*) into n from public.rows where workspace_id = ws.id and table_id = (select id from public.tables where workspace_id = ws.id and kind = 'actions');
  if n <> 2 then raise exception 'expected 2 sample actions, got %', n; end if;
  insert into public.rows (workspace_id, table_id, title) values (ws.id, (select id from public.tables where workspace_id = ws.id and kind = 'actions'), 'x') returning ref_code into r;
  if r <> 'ACT-3' then raise exception 'ref trigger produced %', r; end if;
  select count(*) into n from public.search_workspace(ws.id, 'switchgear');
  if n < 2 then raise exception 'search returned % rows', n; end if;
  perform public.add_member_by_email(ws.id, 'sarah@example.com', 'editor');
  select count(*) into n from public.memberships where workspace_id = ws.id;
  if n <> 2 then raise exception 'expected 2 members, got %', n; end if;
end $$;
select 'smoke ok' as result;
