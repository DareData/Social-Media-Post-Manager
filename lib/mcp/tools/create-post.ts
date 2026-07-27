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
  const actingProfile = await resolveActingProfile(supabase, profile, input.actingAs);
  const categoryIds = await resolveCategoryIds(supabase, input.categoryNames);
  const assigneeId = await resolveAssigneeId(supabase, input.assignee);
  const stages = await fetchStages(supabase);
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

  const images = input.image ? [await uploadPostMedia(supabase, input.image)] : [];

  await syncPostChildren(supabase, id, {
    platforms: input.platforms as (typeof PLATFORMS)[number][],
    descriptions: input.descriptions as Record<(typeof PLATFORMS)[number], string>,
    categoryIds,
    images,
  });

  const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).single();
  const post = mapPostRow(data);

  await logHistory(supabase, post.id, actingProfile.id, ["post created"]);

  return { postNumber: post.postNumber, id: post.id, status: post.status, title: post.title };
}
