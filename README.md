# NoteTrack

A project diary for engineering teams. Captures notes, actions, decisions, risks, gate moves and meetings against a single project, cross-linked with `#item` and `@person` references.

Stack: **Next.js 15** (App Router, RSC) on **Vercel**, **Supabase** (Postgres, Auth, Storage, Realtime), Tailwind for styling.

The visual design is in `docs/design-reference/` — HTML/CSS prototype + screenshots.

---

## Setup (first time)

You need free accounts on:

- [GitHub](https://github.com) — already have one
- [Supabase](https://supabase.com) — for the database & auth
- [Vercel](https://vercel.com) — for hosting

And on your computer: [Node.js 22](https://nodejs.org) (LTS), and `pnpm` (`corepack enable && corepack prepare pnpm@10 --activate`).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Supabase project

1. Go to <https://app.supabase.com> → **New project**.
2. Choose a region close to you, set a strong database password (save it somewhere).
3. Wait ~2 minutes for the project to provision.
4. In the project, go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep this private!)

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and paste the three values above.

### 4. Apply the database schema

In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of:

1. `supabase/migrations/0001_init.sql` — schema, RLS, indexes
2. `supabase/migrations/0002_seed.sql` — sample "South Plant — Phase 2" data
3. `supabase/migrations/0003_create_project_rpc.sql` — RPC for self-serve project creation
4. `supabase/migrations/0004_storage.sql` — storage bucket + policies for the Library

Run each in order.

Then in the Supabase dashboard go to **Database → Replication** and make sure the
`entries`, `actions`, and `gate_moves` tables are added to the realtime
publication so the app's live updates work across tabs.

### 5. Make yourself a member of the seed project

Go to **SQL Editor**, run:

```sql
-- Replace with the email you'll sign in with.
insert into public.memberships (project_id, user_id, role)
select p.id, u.id, 'owner'
from public.projects p, auth.users u
where p.code = 'SP-2' and u.email = 'YOUR-EMAIL@example.com';
```

You'll need to sign in once (next step) for your `auth.users` row to exist before this works.

### 6. Run locally

```bash
pnpm dev
```

Open <http://localhost:3000>, click **Sign in**, request a magic link to your email. The first sign-in creates your `auth.users` row — then run the SQL from step 5, then refresh.

---

## Deploy to Vercel

1. Push to GitHub (the project lives at `Willjfsmith/notetrack`).
2. Go to <https://vercel.com/new>, import the repo.
3. In **Environment Variables**, paste the same three values from `.env.local`.
4. Add `NEXT_PUBLIC_SITE_URL` set to your Vercel domain (e.g. `https://notetrack.vercel.app`).
5. Set the **Production Branch** to `main`.
6. Click **Deploy**.
7. After deploy, copy the deployed URL into your Supabase project's **Authentication → URL Configuration → Site URL** so magic-link redirects work.

### Branch / preview model

- `main` is production. PRs into `main` get Vercel preview deploys automatically.
- Day-to-day work happens on `claude/<topic>-<id>` branches.
- Tag `v0.1.0` once a green build merges to `main` (use `git tag v0.1.0 && git push --tags`).

### Smoke tests

End-to-end smoke tests live in `tests/e2e/` (Playwright). Run them with:

```bash
pnpm exec playwright install --with-deps chromium  # one-time
pnpm test:e2e
```

The authenticated flows (`create entry`, `drag kanban card`) are skipped by
default — they need a logged-in fixture which is straightforward to add once a
service-role test helper exists.

---

## Scripts

| command | what it does |
| --- | --- |
| `pnpm dev` | Start the local dev server at http://localhost:3000 |
| `pnpm build` | Production build (run before deploying) |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run Playwright smoke tests |
| `pnpm format` | Format the codebase with Prettier |

---

## Project layout

```
src/
  app/
    page.tsx                     # Public landing
    login/                       # Magic-link sign-in
    auth/callback/               # OAuth/OTP callback
    select-project/              # Pick which project to work in
    p/[code]/                    # All authenticated app screens
      layout.tsx                 # Shell (sidebar + topbar)
      today/                     # Diary
      pipelines/ actions/ ...    # Sections (stubs in this build)
    styleguide/                  # Dev-only design system page
  components/
    ui/                          # Tone, Avatar, RefChip, Kbd, Button
    shell/                       # Sidebar, TopBar
  lib/
    supabase/                    # server / client helpers
    utils.ts
  middleware.ts                  # Auth guard for /p/* and /select-project

supabase/migrations/             # Schema + seed
docs/design-reference/           # HTML/CSS prototype + screenshots
```

---

## Build status

This repo is the **scaffold** (Prompts 1–6 of the build plan in `docs/BUILD_PLAN.md`):

- ✅ Next.js + Tailwind + Supabase clients
- ✅ Magic-link auth + project selection
- ✅ Database schema + RLS + seed
- ✅ Design tokens + primitives (Tone / Avatar / RefChip / Kbd / Button)
- ✅ App shell + Today (Home) page
- ✅ Composer + slash parser + createEntry server action (Prompt 7)
- ✅ Actions register with filters / keyboard shortcuts (Prompt 8)
- ✅ Pipelines kanban with drag-and-drop + gate entries (Prompt 9)
- ✅ Risks 5×5 register with heatmap (Prompt 10)
- ✅ Meetings live notes via shared composer + realtime (Prompt 11)
- ✅ Library / People / Watching / Item Detail / ⌘K search (Prompt 12)
- ✅ Realtime, skeletons, error boundaries, smoke tests (Prompt 13)

Remaining setup not in the repo: import to Vercel, set env vars, set the
production branch to `main`, and tag `v0.1.0` once the first green deploy lands.
