@AGENTS.md
# Buzzie — Planning Notes

> Internal tool for the GenOS marketing team to create, review, schedule, and track social media posts.
> This document captures every planning decision made so far, the reasoning behind each, and the questions still open. It is a living spec — update it as decisions get made.

---

## 1. What this tool IS (and is NOT)

- It is an **internal tracking tool** for the marketing team. Everyone on the team uses one shared board.
- It does **NOT** publish anything to LinkedIn, Instagram, or X. There is no connection to any platform's API.
- **"Scheduled" and "Published" are status labels only.** A human still copy-pastes the content into each platform manually. This keeps the project small and buildable.

---

## 2. What a "post" is (the core data model)

**Resolved (was an open question early on):** a post targets **one or more platforms at once**, each with its own text description and its own published-link field — not "normally one platform." This has been true since the original schema (`post_platforms`, one row per post+platform).

A post = **one or more images/videos + a per-platform text description + one or more platforms.**

- Platforms: **LinkedIn, Instagram, or X.**
- Character limits shown per platform:
  - LinkedIn: **3000**
  - Instagram: **2200**
  - X: **280**

### Fields a post carries
- Platforms (one or more of LinkedIn / Instagram / X), each with its own text description and published-link field
- Images/videos (zero or more, ordered — per-platform limits: Instagram 20 / LinkedIn 9 / X 4)
- Status (workflow stage — see section 4)
- Assignee (who is working on it)
- Requested by (who asked for the post — separate from the assignee; can be anyone, not just marketing)
- Target date (optional but encouraged — see section 5)
- Categories / tags (multiple allowed — see section 6)
- Needs-changes flag (see section 4) and the timestamp it was last raised
- Soft-delete fields (deleted_at/deleted_by/delete_reason) — deleting a post marks it, doesn't remove the row, so it can be restored from Trash

---

## 3. Access & login

- **Superseded:** the earlier plan was one shared board with identical permissions for everyone. That's no longer true — a real two-tier permission model shipped (`profiles.is_marketing`, enforced via Postgres RLS, not just hidden in the UI):
  - **Marketing team members** (`is_marketing = true`) get full board/calendar/list access — see everything, edit everything, identical permissions *among themselves*.
  - **Everyone else** with a company email automatically gets a profile on first login too, but is restricted to a suggestion-box-only view (`/suggest`) — they can submit ideas but can't see or touch the board.
  - New sign-ins default to `is_marketing = false`; promoting someone to marketing is a manual, out-of-band admin action (a one-off SQL update), not something the app UI can do — this is deliberate, so no authenticated user can grant themselves or anyone else board access.
- **Login: Google sign-in restricted to the company email domain** (built into Supabase) — **shipped and live**, not just a recommendation.
  - Reasoning: the app is deployed on a public URL, so *some* door is required — the choice is only *which* door, not whether to have one.
  - Google sign-in is lower-effort than a shared password (mostly configuration, no login page to build, nothing to leak or rotate), and it's one click for the team since they're already logged into their work Google account.
  - Bonus: every action is tied to a real person, so "who moved this to Approved?" is answerable — which matters once several people edit the same board.

---

## 4. Workflow / board stages

The project brief suggested: `Draft → Review → Approved → Scheduled → Published`.
The team's *actual* ClickUp flow is: `Backlog → To Do → Writing → Designing → In Review → Changes Requested`.
The brief is a **starting suggestion, not a strict spec** — so we're building a **merged** workflow that fits how the team really works while adding the useful scheduling/publishing tail from the brief.

### Proposed merged stages
`Backlog → Writing → Designing → In Review → Approved → Scheduled → Published`

Reasoning behind the merge:
- **Writing and Designing kept separate** — the team deliberately splits copy work from image work, because they often move at different speeds / different people. (Could be merged later if it turns out one person always does both.)
- **"To Do" folded into "Backlog"** — both mean "not started." One bucket is cleaner. **Resolved** — there is no separate "To Do" stage.
- **Approved / Scheduled / Published added** from the brief — these are the useful end-of-pipeline states the current ClickUp doesn't model well, and they're what make the calendar useful.
- **"Changes Requested" handling: resolved as a flag**, not a column — `posts.needs_changes` (+ `needs_changes_set_at`, so the UI can show *which* comment explains why), set automatically whenever a post is dragged backward out of a review stage. Matches the original recommendation.

### Stages are now team-editable, with real behavior attached
Stages aren't a hardcoded list anymore — they're rows in a `board_stages` table (Manage Stages, in Settings), each carrying flags that drive actual app behavior:
- `requires_target_date` — dragging a post here without a date forces the date picker open (only `Scheduled` has this today)
- `requires_published_url` — dragging here without a published link per platform forces that dialog open (only `Published` today)
- `blocks_delete` — posts in this stage can't be deleted, only restored-from later (only `Published`; at least one stage must always carry this flag, enforced by a DB trigger)
- `counts_for_media_purge` — whether posts here count toward the storage cleanup job
- `is_review_stage` — dragging a post *backward* out of a stage with this flag is what sets `needs_changes`
- `is_archive_stage` — shown in the Board's compressed "last 3 weeks" column, with the rest in Archive
- `locks_editing` — most fields become read-only on the post form
- `is_default_new_post_stage` — where a freshly created post starts (`Backlog`)

---

## 5. Dates & the views

- Every post can have a **target date, set at creation** (early), so the team knows *when they need to work* on it — matching how they plan in ClickUp today.
- Date is **optional but strongly encouraged.** A post with no date yet is allowed (an "idea, no date").
- **Safety net:** if a post is dragged to **Scheduled** without a date, the app **forces the user to pick one** right then.
- The Calendar also supports **dragging a post to a different day** to reschedule it directly, instead of requiring a trip into the post's edit form.
- The Calendar's week-start day (Sun/Mon/any day) is a personal preference (Preferences, in Settings), not shared team data.

### Three views over ONE set of posts
The same posts are shown three ways (not separate databases — one set of posts, three lenses):
1. **Board view (Kanban)** — good for "what's stuck in review?" Drag posts between status columns.
2. **Calendar view (month)** — good for "what's going out next week?" Click a day to see the posts on it, with assignee and status. This matches how the team lives in ClickUp today (they're calendar-native).
3. **List view** — a dense, sortable table, grouped by stage; a personal toggle (the "eye" icon in the filter bar) switches Board ↔ List. Added after launch, once the team wanted a denser view for scanning many posts at once.
- The calendar shows any post **that has a date, at any status.**

---

## 6. Categories / tags

- Each post can have **multiple categories at once** (e.g. "Internal" + "Meet the Team" together).
- Example categories: **Meet the Team, Internal, GenOS** (more to be defined with the team).
- Categories will become **filters** on both the board and calendar.

---

## 7. Image preview

- **Decision reversed (2026-07-15):** the preview should now be as faithful as practical to each platform's real caption-truncation behavior, so it doesn't mislead the person writing the post. The earlier "simple, rough preview" call (below) is superseded.
- Implementation approximates truncation by **character count**, not CSS line-clamp, since visual line count depends on container width/font rendering: LinkedIn mobile ~210 chars before "…see more", Instagram mobile ~125 chars before "… more", X shown in full (280-char cap already fits without clipping). Desktop views show the caption in full, matching each platform's expanded/desktop behavior.
- These cutoffs are a best-effort approximation, not verified live against the platforms — they will drift as LinkedIn/Instagram/X tweak their UI. Re-check the numbers in `components/posts/mockups/captionPreview.ts` against the real apps periodically.
- ~~The team wants a simple, rough preview — image + text shown together so it "looks roughly right." NOT a faithful per-platform mockup with exact caption-truncation rules. (Faithful truncation is more work, the rules drift as platforms change, and the team confirmed they don't need it.)~~ *(superseded above)*

---

## 8. Filtering

- Filter posts by **platform** and **date** (from the brief).
- Plus filter by **category** and **assignee** (added). The assignee filter only lists marketing profiles — suggestion-box-only people never had posts to assign in the first place.

---

## 9. Tech stack (from the brief, plus what shipped since)

- **Framework:** Next.js (TypeScript) — same stack as the GenOS website, so patterns can be copied directly.
- **UI components:** shadcn/ui (pre-built components).
- **Database:** Supabase (hosted Postgres + JavaScript client). Also provides the Google auth and file storage (real image/video uploads, not just preview links).
- **Deploy:** Vercel, connected to a GitHub repo (auto-deploys on push, when the Git integration is properly connected).
- **Drag-and-drop:** @hello-pangea/dnd (Kanban board, and now also the Calendar's day-to-day rescheduling).
- **Analytics:** a background job syncs GA4 session/engagement data per post+platform (matched via UTM-tagged links), surfaced in a dedicated Analytics view and on each post.
- **Claude/MCP integration:** the app exposes an MCP server so Claude (Desktop, claude.ai, Claude Code) can read/write posts, comments, and analytics via chat, authenticated with a per-profile API token (Settings → Dev Tools → Connect to Claude).
- Account/infra ownership (which GitHub org, Supabase org, Vercel account this lives under) is **operational**, not product spec — see the repo's `README.md` for that.

---

## OPEN QUESTIONS

None outstanding from the original launch list — the six questions that used to live here (multi-platform posts, Google login, "To Do" vs. Backlog, Changes Requested column-vs-flag, multiple images, the full post field list) are all resolved; each answer is folded into its relevant section above instead of kept as a separate stale list. Add new open questions here as they come up.

---

## Decisions log (quick reference)

| Topic | Decision |
|---|---|
| Auto-publish? | No — status labels only |
| Post = | N images/videos + per-platform text + N platforms |
| Char limits | LinkedIn 3000 / Instagram 2200 / X 280 |
| Permissions | Two-tier: marketing (`is_marketing`) gets full board access; everyone else with a company email gets suggestion-box-only, enforced via RLS |
| Login | Google (company domain) — shipped, live |
| Preview | Faithful per-platform truncation approximation, not the earlier "simple" call (superseded 2026-07-15) |
| Date | Optional at creation, forced when dragged to Scheduled; also draggable directly on the Calendar |
| Views | Board + Calendar + List over one set of posts |
| Categories | Multiple per post; become filters (platform/category/assignee/date) |
| Stages | Backlog → Writing → Designing → In Review → Approved → Scheduled → Published — team-editable, each with behavior flags (see section 4) |
| Stack | Next.js/TS, shadcn/ui, Supabase (+ Storage), Vercel, @hello-pangea/dnd, GA4 sync, MCP server for Claude |