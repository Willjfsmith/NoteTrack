# NoteTrack

A diary and a set of tables, cross-linked. Built for an engineer who also runs a department.

- **Diary.** One chronological stream. `/todo`, `/done`, `/decision`, `/risk`, `/call` type an entry; `#REF` links a row, `@id` mentions a person, `due:fri` sets a date, `p:4 i:3` scores a risk. Entries can be edited (the previous version is kept) or struck out. Sketches drawn with an Apple Pencil attach as images; handwriting typed through iPadOS Scribble just works.
- **Tables.** Projects, People, Items, Actions, Decisions, Risks, Meetings, Stakeholders out of the box, plus any you add. Each table has typed properties (text, number, select, multi-select, date, person, relation, checkbox, URL), a list layout and a board layout, filters, sort, and saved views.
- **Rows.** Every row has a page: its properties, the diary entries that mention it, and backlinks from other tables (a person's actions, a project's items and risks). A Meetings row's page is a notes pad whose lines become diary entries.
- **Search and export.** Full-text search across entries and rows. Any diary range, row, or table exports to Markdown.

Stack: Next.js 15 (App Router) on Vercel, Supabase (Postgres, Auth, Storage, Realtime), Tailwind. Web only; works in Safari on an iPad.

---

## Setup

You need a [Supabase](https://supabase.com) project and a [Vercel](https://vercel.com) account, both free. Locally: Node 22 and pnpm (`corepack enable && corepack prepare pnpm@10 --activate`).

### 1. Install

```bash
pnpm install
```

### 2. Create a Supabase project

Project Settings → API gives you the three values for `.env.local`:

```bash
cp .env.example .env.local
```

### 3. Apply the schema

Open **SQL Editor → New query** and run, in order:

1. `supabase/migrations/0001_init.sql` — tables, RLS, triggers, realtime
2. `supabase/migrations/0002_functions.sql` — `create_workspace`, `add_member_by_email`, `search_workspace`
3. `supabase/migrations/0003_storage.sql` — the `attachments` bucket and its policies

They are idempotent; re-running is safe. If you used the pre-v0.2 schema (projects / items / pipelines), use a fresh Supabase project: the model changed and there is no data migration.

### 4. Sign in and create a workspace

```bash
pnpm dev
```

Open <http://localhost:3000>, sign in with a magic link, and create a workspace. Tick *include a sample project* the first time so the screens are not empty. The workspace seeds the eight tables, their properties, a few saved views, and a People row for you.

### 5. Deploy to Vercel

1. Import the GitHub repo at <https://vercel.com/new>.
2. Add the environment variables from `.env.local`, plus `NEXT_PUBLIC_SITE_URL` set to your Vercel domain.
3. In Supabase, **Authentication → URL Configuration**, add the Vercel domain (and `https://*-<your-team>.vercel.app/**` for previews) to the redirect allow-list and set the Site URL.
4. Every pull request gets a preview deployment; `main` is production.

---

## Using it

| You type | What happens |
| --- | --- |
| `Walked the plinth pour #SAG-mill` | A note linked to the row `SAG-mill`. Unknown refs create a row in the Items table. |
| `/todo markup pump curves #PMP-101 @sk due:thu` | An action owned by `sk`, due Thursday, in the Actions table, linked to the item. |
| `/done paid the comms invoice` | An action already marked done. |
| `/decision switch gearbox vendor #SAG-mill` | A proposed decision in the Decisions table. |
| `/risk HV switchgear lead time #SWG-401 @lr p:4 i:4` | A risk scored 16, owned by `lr`. |
| `/done #ACT-241 sent the markup` | Closes the existing action ACT-241 and logs the entry against it. Any `/todo`, `/risk` or `/decision` line that names an existing row updates it instead of creating one. |
| `/risk #RSK-14 status:closed p:1` | Updates that risk's status and probability. `status:` works on actions and decisions too. |
| `/meeting Steerco weekly` | Creates a Meetings row, marks it live, and opens its notes pad. |
| `walked the pour at:yesterday@14:30` | Backdates the entry. Also `at:14:30`, `at:mon`, `at:2026-09-30`, `at:-2d`. |
| `@me` | You, via the People row linked to your sign-in. Also a filter value for person properties, so a saved view can mean "whoever is signed in". |

On a table page, click a cell to edit it. Switch to the board, group by any select property, and drag a card: the property changes and the diary records a `gate` entry. Filters, sort and grouping save as named views; a pinned view sits at the top of the sidebar. The seeded "On me" view is open actions where owner is `@me`.

The diary has Today / This week / Last week / 30 days presets, and the Markdown export follows whatever range and project are showing.

On the iPad, the composer accepts Pencil handwriting through Scribble, and the pen icon opens a canvas for a sketch. Finger touches are ignored on the canvas unless you switch them on, which gives palm rejection for free. Sketches are saved once and are not editable afterwards.

Adding a member: Settings → Members, enter the email of someone who has already signed in once. Nothing is emailed.

---

## Scripts

| command | what it does |
| --- | --- |
| `pnpm dev` | Dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest): composer parser, property logic, Markdown export |
| `pnpm test:e2e` | Playwright smoke tests for the public pages |

CI (`.github/workflows/ci.yml`) runs all of those on every pull request, and applies the migrations plus `supabase/ci/smoke.sql` against a plain Postgres with stubbed `auth` and `storage` schemas.

---

## Layout

```
src/
  app/
    page.tsx                 # landing
    login/  auth/callback/   # magic-link sign-in
    w/page.tsx               # workspace picker + create
    w/[slug]/
      layout.tsx             # sidebar + ⌘K palette
      diary/                 # the diary
      t/[table]/             # a table: list / board, filters, views
      r/[ref]/               # a row page
      search/  settings/     # full-text search; tables, properties, members
      export/route.ts        # Markdown export
  components/
    composer/  diary/  ink/  # composer, entry list, sketch canvas
    table/  row/  settings/  # table views + cell editors, row page parts, settings forms
    shell/  ui/              # sidebar, palette, primitives
  lib/
    types.ts  props.ts       # domain types; property coercion / filter / sort / group (pure)
    workspace/  rows/  entries/  tables/  views/  members/  attachments/
    composer/parse.ts        # the slash-command parser (pure)
    export/markdown.ts       # Markdown export (pure)
supabase/
  migrations/                # 0001 schema · 0002 functions · 0003 storage
  ci/                        # stubs + smoke SQL for plain Postgres
docs/
  BUILD_PLAN.md              # what v0.2 is, and what is deliberately left out
  design-reference/          # the original v0.1 prototype, kept for reference
```
