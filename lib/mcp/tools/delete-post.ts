import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { fetchPostByNumberOrId, logHistory, resolveActingProfile, McpToolError } from "./shared";

export const deletePostSchema = z.object({
  postNumbers: z.array(z.number().int()).min(1).describe("One or more post numbers to delete"),
  reason: z
    .string()
    .optional()
    .describe("Why these are being deleted, if known — optional here, unlike the web UI's Trash flow which requires one"),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this deletion to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type DeletePostInput = z.infer<typeof deletePostSchema>;

// Soft-delete, same as the web UI's Trash flow (never a hard delete, always
// restorable) — just without the required-reason friction, since a chat
// cleanup request ("delete my test posts") is usually its own explanation.
export async function deletePostTool(input: DeletePostInput, profile: Profile, supabase: SupabaseClient) {
  const actingProfile = await resolveActingProfile(supabase, profile, input.actingAs);
  const reason = input.reason?.trim() || "Deleted via Claude";
  const now = new Date().toISOString();

  const results: { postNumber: number; deleted: boolean; error?: string }[] = [];
  for (const postNumber of input.postNumbers) {
    try {
      const post = await fetchPostByNumberOrId(supabase, { postNumber });
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: now, deleted_by: actingProfile.id, delete_reason: reason })
        .eq("id", post.id);
      if (error) throw new McpToolError(error.message);
      await logHistory(supabase, post.id, actingProfile.id, [`deleted: ${reason}`]);
      results.push({ postNumber, deleted: true });
    } catch (err) {
      results.push({ postNumber, deleted: false, error: err instanceof McpToolError ? err.message : "Unknown error" });
    }
  }
  return { results };
}
