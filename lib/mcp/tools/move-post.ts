import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, Profile } from "@/lib/types";
import {
  fetchHistoryContext,
  fetchPostByNumberOrId,
  fetchStages,
  logHistory,
  needsChangesPatch,
  resolveActingProfile,
  summarizePostChanges,
  syncPostChildren,
  McpToolError,
} from "./shared";

export const movePostSchema = z.object({
  postNumber: z.number().int(),
  status: z.string().min(1).describe("Target stage id — call list_stages first to see current valid ids/labels"),
  targetDate: z.string().date().optional().describe("Required if the target stage requires a target date and the post has no date yet"),
  publishedUrls: z
    .record(z.string(), z.string().url())
    .optional()
    .describe("Published link per platform, keyed by platform name — required for any platform on this post that doesn't have one yet, if the target stage requires it"),
  actingAs: z
    .string()
    .optional()
    .describe(
      "Name or email of the person actually chatting, if this connector is shared and you know it (ask once per conversation and remember for next time) — attributes this move to them instead of whoever generated the shared token. Omit if unknown.",
    ),
});

export type MovePostInput = z.infer<typeof movePostSchema>;

// Mirrors the board's drag-and-drop rules (components/board/Board.tsx): a
// stage flagged requiresTargetDate/requiresPublishedUrl needs one supplied
// here too, since MCP calls skip the UI dialogs that would otherwise prompt.
export async function movePostTool(input: MovePostInput, profile: Profile, supabase: SupabaseClient) {
  // None of these three depend on one another — fetching them together
  // instead of one after another cuts this tool's minimum latency roughly
  // to whichever single one is slowest, not their sum.
  const [actingProfile, current, stages] = await Promise.all([
    resolveActingProfile(supabase, profile, input.actingAs),
    fetchPostByNumberOrId(supabase, { postNumber: input.postNumber }),
    fetchStages(supabase),
  ]);
  const oldStage = stages.find((s) => s.id === current.status);
  const newStage = stages.find((s) => s.id === input.status);
  if (!newStage) {
    throw new McpToolError(
      `"${input.status}" isn't a known stage. Valid stages: ${stages.map((s) => `${s.id} (${s.label})`).join(", ")}.`,
    );
  }

  if (newStage.requiresTargetDate && !current.targetDate && !input.targetDate) {
    throw new McpToolError(`Post #${input.postNumber} needs a target date before it can move to ${newStage.label} — pass targetDate.`);
  }
  if (newStage.requiresPublishedUrl) {
    const missing = current.platforms.filter((p) => !current.publishedUrls[p] && !input.publishedUrls?.[p]);
    if (missing.length) {
      throw new McpToolError(
        `Post #${input.postNumber} needs a published link for ${missing.join(", ")} before it can move to ${newStage.label} — pass publishedUrls.`,
      );
    }
  }

  const changesPatch = oldStage ? needsChangesPatch(oldStage, newStage) : {};
  const columns: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (changesPatch.needsChanges !== undefined) columns.needs_changes = changesPatch.needsChanges;
  if (changesPatch.needsChangesSetAt !== undefined) columns.needs_changes_set_at = changesPatch.needsChangesSetAt;
  if (input.targetDate) columns.target_date = input.targetDate;

  const { error } = await supabase.from("posts").update(columns).eq("id", current.id);
  if (error) throw new McpToolError(`Couldn't move post #${input.postNumber}: ${error.message}`);

  if (input.publishedUrls) {
    await syncPostChildren(supabase, current.id, {
      platforms: current.platforms,
      descriptions: current.descriptions,
      publishedUrls: { ...current.publishedUrls, ...input.publishedUrls },
    });
  }

  const patch: Partial<Post> = { status: input.status };
  if (input.targetDate) patch.targetDate = input.targetDate;
  if (input.publishedUrls) patch.publishedUrls = { ...current.publishedUrls, ...input.publishedUrls };

  const historyContext = await fetchHistoryContext(supabase, stages);
  await logHistory(supabase, current.id, actingProfile.id, summarizePostChanges(current, patch, historyContext));

  return { postNumber: input.postNumber, status: input.status };
}
