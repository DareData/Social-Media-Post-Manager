import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPostRow, mapSuggestionRow, POST_SELECT } from "@/lib/supabase/mappers";
import type { Profile } from "@/lib/types";
import { fetchStages, logHistory, resolveActingProfile, syncPostChildren, McpToolError } from "./shared";

export const reviewSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  action: z.enum(["accept", "dismiss"]).describe("accept turns it into a post (like list_suggestions then create), dismiss just closes it"),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this review to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type ReviewSuggestionInput = z.infer<typeof reviewSuggestionSchema>;

// Mirrors the Suggestions inbox's "Turn into post" / "Dismiss" buttons.
export async function reviewSuggestionTool(input: ReviewSuggestionInput, profile: Profile, supabase: SupabaseClient) {
  // Stages are only needed for "accept", but input.action is already known
  // without waiting on anything — no reason to fetch it only after the
  // suggestion lookup comes back when it doesn't depend on that result.
  const [actingProfile, { data: row, error: findError }, stages] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    supabase.from("suggestions").select("*").eq("id", input.suggestionId).single(),
    input.action === "accept" ? fetchStages(supabase) : Promise.resolve(null),
  ]);
  if (findError || !row) throw new McpToolError(`No suggestion found with id ${input.suggestionId}.`);
  const suggestion = mapSuggestionRow(row);
  if (suggestion.status !== "new") throw new McpToolError(`Suggestion ${input.suggestionId} was already ${suggestion.status}.`);

  const now = new Date().toISOString();

  if (input.action === "dismiss") {
    const { error } = await supabase
      .from("suggestions")
      .update({ status: "dismissed", reviewed_by: actingProfile.id, reviewed_at: now })
      .eq("id", input.suggestionId);
    if (error) throw new McpToolError(`Couldn't dismiss the suggestion: ${error.message}`);
    return { dismissed: true };
  }

  const defaultStageId = stages!.find((s) => s.isDefaultNewPostStage)?.id ?? stages![0]?.id ?? "backlog";

  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("posts").insert({
    id,
    title: suggestion.description.slice(0, 60),
    status: defaultStageId,
    target_date: null,
    needs_changes: false,
    assignee_id: null,
    requested_by_id: suggestion.submittedBy,
    created_by: actingProfile.id,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw new McpToolError(`Couldn't create the post: ${insertError.message}`);

  await syncPostChildren(supabase, id, {
    platforms: ["linkedin"],
    descriptions: { linkedin: suggestion.description, instagram: "", x: "" },
    images: suggestion.imageUrl ? [{ imageUrl: suggestion.imageUrl, mediaType: "image" }] : [],
  });

  // All three below only need `id` (generated above) — none has to wait for
  // the others, including the final select just used for the return value.
  const [{ data }] = await Promise.all([
    supabase.from("posts").select(POST_SELECT).eq("id", id).single(),
    supabase
      .from("suggestions")
      .update({ status: "accepted", reviewed_by: actingProfile.id, reviewed_at: now, resulting_post_id: id })
      .eq("id", input.suggestionId),
    logHistory(supabase, id, actingProfile.id, ["created from a suggestion"]),
  ]);
  const post = mapPostRow(data);

  return { postNumber: post.postNumber, id: post.id, status: post.status, title: post.title };
}
