import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPostRow, POST_SELECT } from "@/lib/supabase/mappers";
import type { Profile } from "@/lib/types";
import { fetchPostByNumberOrId, fetchStages, logHistory, resolveActingProfile, syncPostChildren, McpToolError } from "./shared";

export const duplicatePostSchema = z.object({
  postNumber: z.number().int(),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type DuplicatePostInput = z.infer<typeof duplicatePostSchema>;

// Mirrors PostPreviewModal's "Duplicate" button: same platforms/copy/images/
// categories, but reset to the default stage with no date, assignee, or
// published links — a fresh draft to tweak, not a live re-publish.
export async function duplicatePostTool(input: DuplicatePostInput, profile: Profile, supabase: SupabaseClient) {
  // Independent of one another — fetching together halves the round trips.
  const [actingProfile, source, stages] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    fetchPostByNumberOrId(supabase, { postNumber: input.postNumber }),
    fetchStages(supabase),
  ]);
  const defaultStageId = stages.find((s) => s.isDefaultNewPostStage)?.id ?? stages[0]?.id ?? "backlog";

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const { error } = await supabase.from("posts").insert({
    id,
    title: source.title ? `${source.title} (copy)` : "",
    status: defaultStageId,
    target_date: null,
    needs_changes: false,
    keep_media: source.keepMedia,
    assignee_id: null,
    requested_by_id: null,
    created_by: actingProfile.id,
    created_at: timestamp,
    updated_at: timestamp,
  });
  if (error) throw new McpToolError(`Couldn't duplicate post #${input.postNumber}: ${error.message}`);

  await syncPostChildren(supabase, id, {
    platforms: source.platforms,
    descriptions: source.descriptions,
    categoryIds: source.categoryIds,
    images: source.images.map((img) => ({ imageUrl: img.imageUrl, mediaType: img.mediaType })),
  });

  // logHistory only needs the id generated above — no need to wait for the
  // post_number to come back from the database first.
  const [{ data }] = await Promise.all([
    supabase.from("posts").select(POST_SELECT).eq("id", id).single(),
    logHistory(supabase, id, actingProfile.id, [`duplicated from #${input.postNumber}`]),
  ]);
  const post = mapPostRow(data);

  return { postNumber: post.postNumber, id: post.id, status: post.status, title: post.title };
}
