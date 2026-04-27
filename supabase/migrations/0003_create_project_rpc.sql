-- NoteTrack — self-serve project creation.
-- Lets any authenticated user create a project and become its owner in one
-- atomic call. Bypasses RLS via security definer because the caller has no
-- membership row yet (the function creates the first one).

create or replace function public.create_project(p_name text, p_code text)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_project public.projects;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;

  -- Normalize code: trim/upper, fall back to generated suffix.
  v_code := nullif(btrim(coalesce(p_code, '')), '');
  if v_code is null then
    v_code := 'P-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.projects (code, name)
  values (v_code, btrim(p_name))
  returning * into v_project;

  insert into public.memberships (project_id, user_id, role)
  values (v_project.id, v_uid, 'owner');

  return v_project;
end;
$$;

revoke all on function public.create_project(text, text) from public;
grant execute on function public.create_project(text, text) to authenticated;
