-- patch_001_rls_fix.sql
-- Run this in the Supabase SQL Editor AFTER 0001_init.sql failed on the DO $$ block.
-- The DO $$ block was rolled back in full, so we re-run it here with pipeline_stages removed,
-- then add bespoke pipeline_stages policies and all remaining entry-linked policies.

-- ----- generic per-project tables (members read; editors write) -----
do $$
declare
  t text;
  per_project text[] := array[
    'people','pipelines','items','entries','attachments'
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
create policy actions_read on public.actions
  for select using (
    exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_member(e.project_id)));
create policy actions_write on public.actions
  for all using (
    exists(select 1 from public.entries e where e.id = actions.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy decisions_read on public.decisions
  for select using (
    exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_member(e.project_id)));
create policy decisions_write on public.decisions
  for all using (
    exists(select 1 from public.entries e where e.id = decisions.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy risks_read on public.risks
  for select using (
    exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_member(e.project_id)));
create policy risks_write on public.risks
  for all using (
    exists(select 1 from public.entries e where e.id = risks.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy gate_moves_read on public.gate_moves
  for select using (
    exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_member(e.project_id)));
create policy gate_moves_write on public.gate_moves
  for all using (
    exists(select 1 from public.entries e where e.id = gate_moves.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy meetings_read on public.meetings
  for select using (
    exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_member(e.project_id)));
create policy meetings_write on public.meetings
  for all using (
    exists(select 1 from public.entries e where e.id = meetings.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy meeting_attendees_read on public.meeting_attendees
  for select using (
    exists(select 1 from public.meetings m
      join public.entries e on e.id = m.entry_id
      where m.entry_id = meeting_attendees.meeting_id and public.is_member(e.project_id)));
create policy meeting_attendees_write on public.meeting_attendees
  for all using (
    exists(select 1 from public.meetings m
      join public.entries e on e.id = m.entry_id
      where m.entry_id = meeting_attendees.meeting_id and public.is_editor(e.project_id)))
  with check (true);

create policy subtasks_read on public.subtasks
  for select using (
    exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_member(e.project_id)));
create policy subtasks_write on public.subtasks
  for all using (
    exists(select 1 from public.entries e where e.id = subtasks.action_entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy entry_refs_read on public.entry_refs
  for select using (
    exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_member(e.project_id)));
create policy entry_refs_write on public.entry_refs
  for all using (
    exists(select 1 from public.entries e where e.id = entry_refs.entry_id and public.is_editor(e.project_id)))
  with check (true);

create policy comments_read on public.comments
  for select using (
    exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)));
create policy comments_write on public.comments
  for all using (
    exists(select 1 from public.entries e where e.id = comments.entry_id and public.is_member(e.project_id)))
  with check (author_id = auth.uid());

-- ----- watches: per-user only -----
create policy watches_self on public.watches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
