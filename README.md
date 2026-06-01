# In-Sync SMB Connect

SMB Connect — association / member engagement and event-registration platform
for small and medium businesses.

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn-ui
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **Hosting:** Cloudflare Pages (`smb-sync` → `smbconnect.in`)
- **Scheduled jobs:** Cloudflare Workers (`cron-worker/`)

## Local Development

```sh
npm install
npm run dev          # http://localhost:8080
npm run build        # outputs to dist/
npm run lint
```

`.env` (gitignored) must contain at minimum:

```env
VITE_SUPABASE_URL=https://zcmfxpknsybponbudyqb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_PROJECT_ID=zcmfxpknsybponbudyqb
```

Only values prefixed `VITE_` are inlined into the browser bundle. Anything that
grants write access (service role key, `sbp_` token, Cloudflare API token) must
NOT be prefixed `VITE_`.

## Deploy — `git push origin main` (the only deploy path)

Everything ships from a single `git push origin main`. There are no manual
`wrangler` or `supabase` CLI steps. Three GitHub Actions workflows fan out by
which paths changed:

| Workflow | Fires when you change | What it does |
| --- | --- | --- |
| `pages-deploy.yml` | anything except `supabase/**`, `cron-worker/**`, `*.md` | build + deploy frontend to Cloudflare Pages `smb-sync` |
| `supabase-deploy.yml` | `supabase/**` | `supabase db push`, then deploy **only the changed** edge functions |
| `cron-worker-deploy.yml` | `cron-worker/**` | redeploy each Cloudflare cron Worker from `cron-worker/jobs.txt` |

Required GitHub Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Custom Domain

Production: `https://smbconnect.in` — a proxied CNAME on the Cloudflare zone
points at `smb-sync.pages.dev`.

## Rollback

Use the Cloudflare Pages dashboard to roll back `smb-sync` to a previous
deployment.
