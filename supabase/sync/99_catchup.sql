-- ===== Sync step 9: catch existing v0.2 workspaces up ================
-- Seeds only run for new workspaces. Anything added to the seed later is
-- applied here to workspaces that already exist, guarded so it is idempotent.
do $$
declare
  ws record;
  t_actions uuid;
begin
  for ws in select id from public.workspaces loop
    select id into t_actions from public.tables where workspace_id = ws.id and kind = 'actions';
    if t_actions is not null and not exists (
      select 1 from public.views where table_id = t_actions and name = 'On me'
    ) then
      insert into public.views (table_id, name, layout, config, pinned, sort_order)
      values (t_actions, 'On me', 'list',
        '{"filters":[{"key":"owner","op":"eq","value":"@me"},{"key":"status","op":"neq","value":"done"}],"sort":{"key":"due","dir":"asc"}}',
        true, 0);
    end if;
  end loop;
end $$;

select 'NoteTrack schema is current.' as result;
