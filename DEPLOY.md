# Deploy to Vercel

Mahendra Distributor Portal — production deployment checklist.

## Prerequisites

- GitHub repo with this project pushed
- [Vercel](https://vercel.com) account — **Pro recommended** for business use (Hobby is non-commercial only per Vercel fair-use). Either plan supports large Tally imports now that they route through Supabase Storage.
- Supabase cloud project with migrations applied (`./scripts/setup-cloud.sh` or `supabase db push`)
- Admin user created (`node create_admin.js`)
- Migration `029_tally_imports_bucket.sql` applied — creates the private `tally-imports` bucket with user-scoped RLS and a daily `pg_cron` cleanup job. Verify in Supabase → Storage that the bucket exists.

## 1. Push to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## 2. Import project in Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** your GitHub repo
2. **Framework:** Next.js (auto-detected)
3. **Root directory:** `.` (repo root)
4. **Build command:** `npm run build` (default)
5. **Region:** Mumbai (`bom1`) — set in `vercel.json`

Do **not** deploy yet — add environment variables first.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Add these for **Production** (and Preview if you want):

| Variable | Value | Notes |
|----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zpdrnblpvuijwghfxmgm.supabase.co` | From Supabase dashboard → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Sensitive** — server only |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel URL (no trailing slash) |

Get keys: [Supabase API settings](https://supabase.com/dashboard/project/zpdrnblpvuijwghfxmgm/settings/api)

After first deploy, set `NEXT_PUBLIC_APP_URL` to the real `*.vercel.app` URL and **redeploy** so OG tags and server actions use the correct host.

## 4. Supabase Auth URLs (required for login)

[Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/zpdrnblpvuijwghfxmgm/auth/url-configuration)

| Setting | Value |
|---------|--------|
| **Site URL** | `https://your-app.vercel.app` |
| **Redirect URLs** | `https://your-app.vercel.app/**` |

Add preview URLs too if using Vercel preview deploys:

```
https://*-your-team.vercel.app/**
```

## 5. Deploy

Click **Deploy** (or push to `main` if Git integration is on).

Watch the build log — it should match local:

```
npm run build  →  ✓ Compiled successfully
```

## 6. Create admin (if not done on cloud DB)

From your machine with `.env.local` pointing at cloud Supabase:

```bash
node create_admin.js
```

## 7. Smoke test

| Step | URL |
|------|-----|
| Login | `https://your-app.vercel.app/login` |
| Admin dashboard | `/admin` |
| Supplier portal | `/supplier` |
| System verify | `/admin/verify` |

## 8. Windows + Argox (production)

Open the **Vercel URL** in Chrome on Windows (not `localhost`):

```
https://your-app.vercel.app/login
```

Argox stays USB on Windows; download roll PDF and print in Adobe Reader.

## Optional: custom domain

1. Vercel → Project → **Domains** → add your domain
2. Update Supabase **Site URL** and **Redirect URLs**
3. Set `NEXT_PUBLIC_APP_URL` to the custom domain
4. Redeploy

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Vercel | Run `npm run build` locally; fix TypeScript errors |
| Login works locally, not on Vercel | Add Vercel URL to Supabase Redirect URLs |
| Invalid Server Actions request | Set `NEXT_PUBLIC_APP_URL` to exact Vercel URL, redeploy |
| Large Tally PDF import fails | Now supported via Supabase Storage (migration 029). Files ≤2 MB go inline; larger files upload to the `tally-imports` bucket and are parsed server-side. Max 50 MB per file. |
| Blank data after login | Check all three Supabase env vars in Vercel |

## Verify env before deploy

```bash
npm run check:cloud
```
