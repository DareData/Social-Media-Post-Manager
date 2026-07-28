import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPostRow, POST_SELECT } from "@/lib/supabase/mappers";
import { PLATFORMS } from "@/lib/types";
import type { Profile } from "@/lib/types";
import { fetchStages, logHistory, resolveActingProfile, resolveAssigneeId, resolveCategoryIds, syncPostChildren, uploadPostMedia, McpToolError } from "./shared";

export const createPostSchema = z.object({
  title: z.string().default(""),
  platforms: z.enum(PLATFORMS as [string, ...string[]]).array().min(1).describe("Platforms this post targets: linkedin, instagram, and/or x"),
  descriptions: z
    .record(z.string(), z.string())
    .default({})
    .describe("Post copy per platform, keyed by platform name (e.g. { linkedin: \"...\" })"),
  categoryNames: z.array(z.string()).default([]).describe("Category tags, e.g. [\"Meet the Team\"] — created if they don't exist yet"),
  targetDate: z.string().date().nullable().optional().describe("ISO date (yyyy-mm-dd) this post is targeted for, if known"),
  assignee: z.string().nullable().optional().describe("Full name or company email of the teammate this post is assigned to"),
  image: z
    .union([
      z.object({ url: z.string().url() }),
      z.object({ base64: z.string(), filename: z.string() }),
    ])
    .optional()
    .describe("Either a URL to an already-hosted image, or base64 image bytes + filename (base64 only works reliably from Claude Code reading a local file)"),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this post to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export async function createPostTool(input: CreatePostInput, profile: Profile, supabase: SupabaseClient) {
  // None of these five depend on one another (or on the post row, which
  // doesn't exist yet) — running them together instead of one after another
  // cuts this tool's minimum latency roughly to whichever single one is
  // slowest, not their sum.
  const [actingProfile, categoryIds, assigneeId, stages, uploadedImage] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    resolveCategoryIds(supabase, input.categoryNames),
    resolveAssigneeId(supabase, input.assignee),
    fetchStages(supabase),
    input.image ? uploadPostMedia(supabase, input.image) : Promise.resolve(null),
  ]);
  const defaultStageId = stages.find((s) => s.isDefaultNewPostStage)?.id ?? stages[0]?.id ?? "backlog";

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const { error } = await supabase.from("posts").insert({
    id,
    title: input.title,
    status: defaultStageId,
    target_date: input.targetDate ?? null,
    needs_changes: false,
    assignee_id: assigneeId,
    requested_by_id: actingProfile.id,
    created_by: actingProfile.id,
    created_at: timestamp,
    updated_at: timestamp,
  });
  if (error) throw new McpToolError(`Couldn't create the post: ${error.message}`);

  await syncPostChildren(supabase, id, {
    platforms: input.platforms as (typeof PLATFORMS)[number][],
    descriptions: input.descriptions as Record<(typeof PLATFORMS)[number], string>,
    categoryIds,
    images: uploadedImage ? [uploadedImage] : [],
  });

  // logHistory only needs the id we generated ourselves above — no need to
  // wait for the post_number to come back from the database first.
  const [{ data }] = await Promise.all([
    supabase.from("posts").select(POST_SELECT).eq("id", id).single(),
    logHistory(supabase, id, actingProfile.id, ["post created"]),
  ]);
  const post = mapPostRow(data);

  return { postNumber: post.postNumber, id: post.id, status: post.status, title: post.title };
}
