# NoteTrack — build plan

A 13-prompt sequence for finishing the app. Prompts 1–6 are scaffolded in this commit; prompts 7–13 are still to do.

Each prompt is self-contained — paste it into a fresh Claude Code session in this repo, on the working branch `claude/plan-app-architecture-GUBli`, and let it run.

> Reference assets live in `docs/design-reference/`:
> - `daytrack.css` — design tokens (already ported into `src/app/globals.css` + `tailwind.config.ts`)
> - `daytrack-data.js` — sample data shape
> - `*.html` — full prototype screens
> - `screenshots/` — PNG mockups

---

## ✅ Prompt 1 — Bootstrap (done)
Next.js 15 App Router, TypeScript, Tailwind, ESLint, dependencies, env example, gitignore, base layout.

## ✅ Prompt 2 — Schema + RLS + seed (done)
`supabase/migrations/0001_init.sql` and `0002_seed.sql`. Tables: projects, memberships, people, items, pipelines/stages, entries, actions, decisions, risks, gate_moves, meetings, attendees, subtasks, entry_refs, attachments, comments, watches. RLS for every table. Seeded "South Plant — Phase 2".

## ✅ Prompt 3 — Auth + project context (done, minimal)
Magic-link login (`/login`), callback (`/auth/callback`), middleware guards `/p/*`, project picker (`/select-project`), per-project layout fetches project + verifies membership.

## ✅ Prompt 4 — Design system (done)
Tokens in `globals.css` and `tailwind.config.ts`. Primitives in `src/components/ui/`: Tone, Avatar, RefChip, Kbd, Button. `/styleguide` page renders all of them.

## ✅ Prompt 5 — App shell (done)
Sidebar (`src/components/shell/sidebar.tsx`), TopBar with breadcrumbs, project layout. Stub pages for all eight sections so navigation works.

## ✅ Prompt 6 — Today page (stub done)
`/p/[code]/today` shows hero, read-only composer, right rail. Full diary stream + day-grouping + on-you panel + heatmap + composer wiring is in Prompt 7.

---

## ⬜ Prompt 7 — Composer + slash parser

**goal/context:** Wire up entry creation. Free-text input prefixed with `/note`, `/todo`, `/done`, `/decision`, `/risk`, `/call`. `#XYZ` links items, `@id` mentions people, `$1.2k` attaches money, `due:thu` sets due date.

**do this:**
- `src/lib/composer/parse.ts` — pure function with unit tests (`pnpm add -D vitest`).
- `<Composer>` component with `#`/`@` autocomplete (Supabase lookup), `Cmd+Enter` to submit, optimistic insert.
- Server action `createEntry({ projectId, raw })` that inserts entry + specialised row + entry_refs in a transaction. Stub items if `#XYZ` doesn't exist.

**done when:** typing `/risk HV switchgear lead time #SWG-401 @lr p:4 i:4` creates a risk entry with correct probability/impact, links the item, owner-assigns Leo, and it appears in Today's diary.

---

## ⬜ Prompt 8 — Actions register

**goal/context:** `/p/[code]/actions` — register-style page. Reference `docs/design-reference/Actions.html`.

**do this:** Bucket grouping (Late / Today / This week / Later). Tabs (On you / I requested / Watching / All). Detail pane with Overview / Activity / Sub-tasks / Files. URL-driven filters via `nuqs`. Keyboard shortcuts: `J/K`, `E` snooze, `R` reassign, `L` log, `⌘↵` done.

**done when:** prototype's layout reproduced, all shortcuts work, mutations are optimistic, URL is shareable.

---

## ⬜ Prompt 9 — Pipelines kanban

**goal/context:** `/p/[code]/pipelines` — drag-and-drop kanban; each move creates a `gate` entry.

**do this:** `@dnd-kit/core` board. Server action `moveItem({ itemId, toStageId })` updates `items.current_stage_id` + inserts `gate_moves`. Card shows ref code, title, owner, days-in-stage.

**done when:** dragging emits a gate entry visible in the diary, board state survives reload.

---

## ⬜ Prompt 10 — Risks register

**goal/context:** `/p/[code]/risks` — 5×5 register.

**do this:** Reuse `RegisterShell` from Prompt 8. 5×5 heatmap (color by `p*i`), click cell to filter. Detail with mitigation log + linked actions. Editable p, i, owner, status.

**done when:** heatmap reflects live data, filters work, score updates on edit.

---

## ⬜ Prompt 11 — Meetings (live notes)

**goal/context:** `/p/[code]/meetings` — Today / Upcoming / Past. Live notes that emit child entries via the Prompt 7 parser.

**do this:** Reuse `RegisterShell`. Notes pane treats each paragraph as a composer line, attached via `entries.source_meeting_id`. Outputs tab auto-aggregates child entries by type. Realtime channel for live updates.

**done when:** typing `/action Reply to regulator @me due:today #ENV-AQ-3` in a meeting creates the meeting entry, child action entry, action row owned by the user, and entry_ref to the item — visible everywhere immediately.

---

## ⬜ Prompt 12 — Library, People, Watching, Item Detail, Search

**goal/context:** Wrap remaining surfaces. References: `Library.html`, `People.html`, `Watching.html`, `Item Detail.html`.

**do this:**
- Library: grid of attachments, Storage upload, filter by item/kind/date.
- People: list + profile drawer (recent activity, owned actions/risks).
- Watching: items in `watches` with unread counts since last visit.
- Item Detail: `/p/[code]/items/[ref]` with Activity / Files / Linked / Risks tabs.
- Search: enhance `⌘K` with full-text on `entries.body_md` + `items.title` (uses indexes from Prompt 2).

**done when:** all five surfaces render real data, uploads land in Storage, item detail round-trips, `⌘K` searches across types.

---

## ⬜ Prompt 13 — Realtime, polish, deploy

**goal/context:** Make it live, polish, ship.

**do this:**
- Supabase Realtime on `entries`, `actions`, `gate_moves` so Diary, Actions, and Pipelines update without reload.
- Empty states, skeletons, toast notifications (`sonner`), error boundaries per route segment.
- Lighthouse pass, font preloading, no CLS on hero, `next/image` everywhere.
- Playwright smoke tests: login → create entry → diary; drag card → gate entry.
- Wire Vercel: connect repo, env vars, prod branch = `main`. Tag `v0.1.0` once green.

**done when:** two browser tabs sync without reload, smoke tests pass in CI, Vercel previews on push, `v0.1.0` tagged.
