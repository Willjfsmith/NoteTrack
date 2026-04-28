-- NoteTrack — sample project seed.
-- Mirrors design_handoff_daytrack/designs/daytrack-data.js.
-- Safe to re-run: deletes the SP-2 project first.
--
-- IMPORTANT: once 0005_schema_engine.sql has been applied this file is
-- superseded — re-run 0005 to reseed SP-2 via the engine. We detect the
-- engine by the presence of `public.item_types` and skip silently in that
-- case so re-running every migration in order remains safe.

do $outer$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'item_types'
  ) then
    raise notice 'Schema engine present (0005 applied) — skipping legacy 0002 seed. Re-run 0005 to reseed SP-2.';
    return;
  end if;

  execute $seed$
    delete from public.projects where code = 'SP-2';

    with new_project as (
      insert into public.projects (code, name, phase, color, budget_total, budget_spent, fel3_due_at)
      values ('SP-2', 'South Plant — Phase 2', 'Detail design', 'yellow', 8200000, 3400000, current_date + 38)
      returning id
    ),
    ppl as (
      insert into public.people (project_id, short_id, name, initials, color, role_label)
      select (select id from new_project), s.short_id, s.name, s.initials, s.color, s.role
      from (values
        ('sk','Sarah K.','SK','purple','Process eng.'),
        ('mr','Marc R.','MR','green','Mech. lead'),
        ('jt','Jules T.','JT','pink','Project mgr'),
        ('dn','Diane N.','DN','orange','EPCM rep'),
        ('pv','Pavel V.','PV','yellow','Vendor — Outotec'),
        ('ai','Aisha I.','AI','red','Civil/struct'),
        ('lr','Leo R.','LR','blue','Instr/control')
      ) as s(short_id, name, initials, color, role)
      returning id, short_id
    ),
    pipe as (
      insert into public.pipelines (project_id, name, is_default)
      select (select id from new_project), 'Default', true
      returning id
    ),
    stages as (
      insert into public.pipeline_stages (pipeline_id, name, sort_order)
      select (select id from pipe), s.name, s.sort_order
      from (values
        ('Concept', 1),
        ('Design', 2),
        ('Procurement', 3),
        ('Fabrication', 4),
        ('FAT', 5),
        ('Shipping', 6),
        ('Install', 7),
        ('Commission', 8)
      ) as s(name, sort_order)
      returning id, name
    ),
    itm as (
      insert into public.items (project_id, ref_code, title, kind, current_stage_id)
      select (select id from new_project), i.ref_code, i.title, i.kind,
        (select id from stages where stages.name = i.stage)
      from (values
        ('SAG-mill','SAG mill area','area','Design'),
        ('CV-203','CV-203 conveyor','equipment','Fabrication'),
        ('PMP-101','PMP-101 pump skid','equipment','Shipping'),
        ('SWG-401','HV switchgear','equipment','Procurement'),
        ('CIV-013','CIV-013 plinth drawing','document','Design'),
        ('CIV-014','CIV-014 rebar drawing','document','Design'),
        ('PID-D','P&ID rev D','document','Design'),
        ('TNK-12','Tank #12','equipment','Procurement'),
        ('ELE-310','Electrical room','area','Design'),
        ('ENV-AQ-3','Air quality assessment','document','Design')
      ) as i(ref_code, title, kind, stage)
      returning id, ref_code
    )
    select count(*) from itm;
  $seed$;
end $outer$;
