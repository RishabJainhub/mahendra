# AGENTS.md

## Cursor Cloud specific instructions

Standard setup/verify commands live in `README.md`. The notes below are the
non-obvious caveats for running this app inside a Cursor Cloud VM.

### Services
- **Next.js dev server** (the product) — `npm run dev`, serves on **port 3001**
  (`next dev --turbopack -p 3001`).
- **Supabase local stack** (Postgres + Auth + Storage + Realtime gateway) — the
  backend the app calls. Started with `npx supabase start` (the Supabase CLI is
  fetched on demand via `npx`; it is not a project dependency). Requires Docker.

### Docker (required by Supabase)
- The VM has **no systemd**, so `systemctl start docker` does not work. Start the
  daemon manually and leave it running, e.g. in a tmux session:
  `sudo dockerd` (logs to stdout).
- For non-root `docker`/`supabase` access in the same session run
  `sudo chmod 666 /var/run/docker.sock` after the daemon is up.
- Docker is configured with the `fuse-overlayfs` storage driver and the
  containerd snapshotter disabled (see `/etc/docker/daemon.json`); this is
  required for the kernel in this VM.

### Environment configuration
- Copy `.env.example` to `.env.local`, then fill keys from `npx supabase status`.
- Use the **legacy JWT keys**: `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`. Do **not** use the newer
  `sb_publishable_…` / `sb_secret_…` keys — the app code expects the JWT format.
- `npx supabase start` already applies all migrations. `npx supabase db reset`
  re-applies migrations + seed from scratch.

### Seeding the admin user
- `node create_admin.js` is **interactive** (prompts for email/password) and does
  not seed reliably when stdin is piped. Either run it interactively with the
  Supabase env vars exported, or create the admin directly with the
  service-role key via `@supabase/supabase-js`
  (`supabase.auth.admin.createUser({ email_confirm: true, app_metadata: { role: 'admin', tenant_id: '00000000-0000-0000-0000-000000000001' } })`
  then upsert the matching row into `public.users`). The default tenant
  `00000000-0000-0000-0000-000000000001` ("Mahendra Saree House") is seeded by
  the migrations.

### Linting
- `npm run lint` is **non-functional**: it runs `next lint`, which Next.js 16
  removed (it treats `lint` as a directory arg and errors), and the repo has no
  ESLint config or `eslint` dependency. Use `npm run typecheck`, `npm test`, and
  `npm run build` for verification instead.
