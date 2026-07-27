# Social Media Post Manager

Internal tool for the GenOS marketing team to create, review, schedule, and track social media posts (LinkedIn, Instagram, X). Does **not** publish anything to those platforms — it's a shared tracking board, not an autoposter.

- Product spec / planning decisions: [`CLAUDE.md`](./CLAUDE.md)
- Next.js version-specific quirks: [`AGENTS.md`](./AGENTS.md)

This file is the **operational** doc — how to run it, deploy it, and recover if something breaks or a key person is unreachable.

## Tech stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Storage, Realtime) · Vercel · shadcn/ui · `@hello-pangea/dnd`

## Local development

```bash
npm install
npm run dev
```

Needs a `.env.local` (never committed — see `.gitignore`) with:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — bypasses RLS; used by the MCP server and cron jobs |
| `GOOGLE_OAUTH_CLIENT_ID` | GA4 Data API access (analytics sync) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | GA4 Data API access |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | GA4 Data API access |
| `GA4_PROPERTY_IDS` | Comma-separated GA4 property IDs to sync from |
| `CRON_SECRET` | Shared secret the two cron routes check for, so they can't be triggered by anyone else |

## Setting up a fresh Supabase project

Run the files in `supabase/` **in this exact order**, in the Supabase Dashboard → SQL Editor. This list is already pruned — a few files in that folder are historical and would have **no effect** on a fresh install (explained below), so don't run them.

1. `schema.sql`
2. `team-notes-read.sql`
3. `storage-setup.sql`
4. `comment-reactions.sql`
5. `auth-setup.sql`
6. `enable-realtime-comments.sql`
7. `comment-replies.sql`
8. `add-post-number.sql`
9. `marketing-role-and-suggestions.sql`
10. `soft-delete-posts.sql`
11. `keep-media.sql`
12. `board-stages.sql`
13. `suggestions-read.sql`
14. `post-platform-published-urls.sql`
15. `post-history.sql`
16. `shared-link-profile.sql`
17. `comment-guest-name.sql`
18. `post-analytics-content.sql`
19. `post-analytics-conversions.sql`
20. `post-analytics-geo.sql`
21. `post-analytics-site.sql`
22. `post-needs-changes-timestamp.sql`

**Skip these — they're dead weight, not missing steps:**
- `post-analytics.sql` and `post-analytics-daily.sql` — each creates the `post_analytics` table, but a later file (`post-analytics-content.sql`) drops and recreates it again from scratch. Only the last version survives on a fresh install.
- `protect-published.sql` — its RLS policies get unconditionally dropped and replaced by `marketing-role-and-suggestions.sql` a few files later, which doesn't depend on it having run first. Zero net effect.
- `seed-demo-comments.sql`, `remove-placeholder-profiles.sql` — one-off data scripts from early development (seeding test comments, then later cleaning up test profiles), not schema. Nothing to run on a fresh project.

After the schema is in place, promote whoever needs marketing/board access with a one-off SQL update (`update public.profiles set is_marketing = true where email = '...'`) — this is intentionally not exposed anywhere in the app UI.

## Deploying

Normally: `git push` to `main` → Vercel auto-deploys. **This depends on the Vercel GitHub App being authorized for wherever the repo currently lives** — if the repo ever changes owner (personal account ↔ organization), this breaks silently (no error, the site just stops picking up new pushes) until someone with admin rights on the new owner re-authorizes it.

If auto-deploy isn't firing (check: does the latest Vercel deployment's timestamp match your latest commit?), deploy manually from a local clone:

```bash
vercel --prod
```

### Scheduled jobs

Two cron jobs are configured in `vercel.json` — **this is Vercel-specific**, not portable code:

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/purge-old-media` | daily, 03:00 | Deletes old media for posts past their storage-purge window |
| `/api/cron/sync-ga4-analytics` | daily, 04:00 | Pulls the latest GA4 session data per post/platform |

If this app ever moves off Vercel, these two need re-implementing some other way (e.g. a GitHub Actions scheduled workflow hitting the same routes with the `CRON_SECRET` header) — moving the code alone doesn't bring the schedule with it.

## Accounts this depends on, and how to recover access

None of these should ever depend on one person alone being reachable. Status as of this writing:

- **GitHub** — repo lives in the `DareData` organization (`github.com/DareData/Social-Media-Post-Manager`). Repo-level settings (visibility, collaborators) need an org Owner/Admin to grant — ask whoever administers the DareData GitHub org.
- **Supabase** — currently a personal organization (not yet moved into a company-owned one). A second **Owner** should be added directly in that org's Team page (Organization → Team → Invite members) so access doesn't depend on one account — do this regardless of whether/when a "real" company org gets created, since project ownership can be transferred into one later (Project Settings → Transfer, works between any two orgs the transferring user is at least a Member of).
- **Vercel** — a personal (free/Hobby) account, which doesn't support adding other members at all without upgrading to Pro. This is considered acceptable: Vercel only holds the deploy pipeline, not the code or the data — if access is ever lost, someone can create a fresh Vercel project from the (safely org-owned) GitHub repo and redeploy. This only works smoothly if the env vars above are also documented somewhere the company can reach — confirm that's the case, since Vercel's own env var store isn't a backup of itself.
