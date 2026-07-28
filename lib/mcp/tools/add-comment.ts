import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { fetchPostByNumberOrId, resolveActingProfile, McpToolError } from "./shared";

export const addCommentSchema = z.object({
  postNumber: z.number().int().nullable().describe("The post to comment on, or null for a general team note"),
  body: z.string().min(1),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this comment to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

export async function addCommentTool(input: AddCommentInput, profile: Profile, supabase: SupabaseClient) {
  const [actingProfile, post] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    input.postNumber != null ? fetchPostByNumberOrId(supabase, { postNumber: input.postNumber }) : Promise.resolve(null),
  ]);
  const postId = post?.id ?? null;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: actingProfile.id,
    body: input.body,
    created_at: new Date().toISOString(),
  });
  if (error) throw new McpToolError(`Couldn't add the comment: ${error.message}`);

  return { added: true };
}
