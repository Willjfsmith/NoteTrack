-- Storage bucket for attachments (files and ink sketches).
-- Object paths start with `<workspace_id>/`; membership on that workspace grants access.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "attachments_read_member" on storage.objects;
create policy "attachments_read_member" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists "attachments_write_editor" on storage.objects;
create policy "attachments_write_editor" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
        and m.role in ('owner','editor')
    )
  );

drop policy if exists "attachments_delete_editor" on storage.objects;
create policy "attachments_delete_editor" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
        and m.role in ('owner','editor')
    )
  );
