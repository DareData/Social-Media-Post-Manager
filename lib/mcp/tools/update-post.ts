import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORMS, type Platform, type Post, type Profile } from "@/lib/types";
import {
  fetchHistoryContext,
  fetchPostByNumberOrId,
  logHistory,
  resolveActingProfile,
  resolveAssigneeId,
  resolveCategoryIds,
  summarizePostChanges,
  syncPostChildren,
  McpToolError,
} from "./shared";

export const updatePostSchema = z.object({
  postNumber: z.number().int(),
  title: z.string().optional(),
  descriptions: z.record(z.string(), z.string()).optional(),
  platforms: z.enum(PLATFORMS as [string, ...string[]]).array().min(1).optional(),
  categoryNames: z.array(z.string()).optional(),
  targetDate: z.string().date().nullable().optional(),
  assignee: z.string().nullable().optional().describe("Full name or company email of the teammate this post is assigned to"),
  needsChanges: z.boolean().optional(),
  publishedUrls: z
    .record(z.string(), z.string().url())
    .optional()
    .describe("Published link per platform, keyed by platform name (e.g. { linkedin: \"...\" }) — merges with, rather than replacing, any links already saved"),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this update to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// Deliberately excludes `status` — moving status is move_post's job, so the
// Scheduled-date business rule can't be bypassed through this generic patch.
export async function updatePostTool(input: UpdatePostInput, profile: Profile, supabase: SupabaseClient) {
  // None of these four depend on one another — fetching them together
  // instead of one after another cuts this tool's minimum latency roughly
  // to whichever single one is slowest, not their sum.
  const [actingProfile, current, assigneeId, categoryIds] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    fetchPostByNumberOrId(supabase, { postNumber: input.postNumber }),
    input.assignee !== undefined ? resolveAssigneeId(supabase, input.assignee) : Promise.resolve(undefined),
    input.categoryNames ? resolveCategoryIds(supabase, input.categoryNames) : Promise.resolve(undefined),
  ]);

  const columns: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) columns.title = input.title;
  if (input.targetDate !== undefined) columns.target_date = input.targetDate;
  if (input.needsChanges !== undefined) columns.needs_changes = input.needsChanges;
  if (assigneeId !== undefined) columns.assignee_id = assigneeId;

  const { error } = await supabase.from("posts").update(columns).eq("id", current.id);
  if (error) throw new McpToolError(`Couldn't update post #${input.postNumber}: ${error.message}`);

  const patch: Partial<Post> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.targetDate !== undefined) patch.targetDate = input.targetDate;
  if (assigneeId !== undefined) patch.assigneeId = assigneeId;
  if (input.platforms !== undefined) patch.platforms = input.platforms as Platform[];
  if (input.descriptions !== undefined) patch.descriptions = input.descriptions as Record<Platform, string>;
  if (input.publishedUrls !== undefined) patch.publishedUrls = { ...current.publishedUrls, ...input.publishedUrls };
  if (categoryIds !== undefined) patch.categoryIds = categoryIds;

  // platforms, descriptions, and published links are stored together (one
  // post_platforms row per platform) — if only some of these were patched,
  // merge with what's already there so the rest doesn't get wiped out.
  const touchesPlatformRows = input.platforms !== undefined || input.descriptions !== undefined || input.publishedUrls !== undefined;

  // syncPostChildren and fetchHistoryContext don't depend on each other —
  // the second only needs `current`/`patch`, already known above.
  const [, historyContext] = await Promise.all([
    syncPostChildren(supabase, current.id, {
      platforms: touchesPlatformRows ? ((input.platforms as (typeof PLATFORMS)[number][] | undefined) ?? current.platforms) : undefined,
      descriptions: touchesPlatformRows
        ? ((input.descriptions as Record<(typeof PLATFORMS)[number], string> | undefined) ?? current.descriptions)
        : undefined,
      publishedUrls: touchesPlatformRows ? { ...current.publishedUrls, ...input.publishedUrls } : undefined,
      categoryIds,
    }),
    fetchHistoryContext(supabase),
  ]);

  await logHistory(supabase, current.id, actingProfile.id, summarizePostChanges(current, patch, historyContext));

  return { postNumber: input.postNumber, updated: true };
}
