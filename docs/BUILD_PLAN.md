# NoteTrack — v0.2 plan

## The goal

Get NoteTrack into daily use by one engineer who also runs a department, and let that use decide what comes next. Minimal on purpose. Web only.

## The model

A **workspace** (a department) holds **tables**. A table is a named set of **rows** with typed **properties**. The **diary** is a stream of **entries**. An entry can reference any row; a row's page shows every entry that references it. That is the whole idea.

v0.1 made the project the container and built a bespoke page per concept (actions, risks, pipelines, people, library, watching). v0.2 makes the department the container, turns Project into a table, and replaces the bespoke pages with one table engine. The composer, parser and kanban carried over; the data layer was rewritten.

## What v0.2 ships

| Area | Done |
| --- | --- |
| Schema | workspaces · memberships · tables · properties · rows (JSONB props) · entries · entry_revisions · entry_refs · attachments · views. RLS on everything. Ref-code trigger. Realtime on entries and rows. |
| RPCs | `create_workspace` seeds 8 tables + properties + views + your People row (+ optional sample). `add_member_by_email`. `search_workspace` (tsvector + trigram). |
| Diary | textarea composer (Scribble-friendly), `#`/`@` autocomplete, Enter to log; edit with kept revisions; strike out; project filter, date presets and range; "show older" paging; realtime refresh; Markdown export. |
| Entries → rows | `/todo` `/done` → Actions, `/decision` → Decisions, `/risk` → Risks, each linked back by `source_entry_id`; status / due / score chips in the diary. A line that names an existing row in the matching table updates it (`/done #ACT-3`, `status:`, `due:`, `p:` `i:`). `/meeting` creates a Meetings row and opens it. `at:` backdates. |
| Tables | list layout with inline cell editing and human dates (overdue red, today amber); board layout grouped by any select property with drag (logs a `gate` entry), owners as initials, filtered-out properties hidden; filter builder with `@me`; sort; free-text filter; saved views, pinnable to the sidebar ("On me" seeded); new row; Markdown export. |
| Row page | editable title/ref; properties panel; composer bound to the row; timeline; backlinks from every table whose person/relation property points here; archive; export. Meetings rows get a notes pad with an outputs summary. |
| Ink | write-once Pencil canvas (perfect-freehand): pressure, pen-only by default, undo/redo, whole-stroke eraser; saved as PNG + strokes JSON; shown inline in the diary. Files attach the same way. |
| Search | page + ⌘K palette, both on the same RPC. |
| Settings | create/rename tables, set prefix and the `#ref` default table, add/rename/delete properties, members by email of an existing user. |
| Style | compact, monochrome, one accent; red/amber/green only for meaning. |
| CI | typecheck, lint, unit tests, build; migrations + SQL smoke on plain Postgres. |

## Deliberately left out

Installable app shell, offline mode, photo capture, email invites, digests, dashboard tiles, Watching, Library as a page, comments, formulas, nested pages, a block editor, editing a sketch after saving.

## Next, only if use demands it

- Authenticated Playwright flows (needs a service-role test helper).
- Pagination on the diary beyond 300 entries per view.
- Relation properties that hold several rows.
- A per-user "on you" view (Actions where owner = @me is already one filter away).
