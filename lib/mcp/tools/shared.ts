import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPostRow, mapProfileRow, mapStageRow, POST_SELECT } from "@/lib/supabase/mappers";
import { sanitizeFilename, storagePathFromPublicUrl } from "@/lib/supabase/storagePath";
import type { HistoryContext } from "@/lib/postHistory";
import type { Platform, Post, Profile, Stage } from "@/lib/types";

export { needsChangesPatch } from "@/lib/stageRules";
export { summarizePostChanges } from "@/lib/postHistory";

export class McpToolError extends Error {}

// MCP calls are short-lived, one-request invocations — no persistent store to
// keep stages in, so each tool that needs them fetches fresh rather than
// risking a stale cached list.
export async function fetchStages(supabase: SupabaseClient): Promise<Stage[]> {
  const { data, error } = await supabase.from("board_stages").select("*").order("position", { ascending: true });
  if (error) throw new McpToolError(`Couldn't load stages: ${error.message}`);
  return (data ?? []).map(mapStageRow);
}

// Just enough context for summarizePostChanges to turn ids into names —
// fetched fresh per call, same reasoning as fetchStages above. Pass
// `stages` when the caller already fetched them for its own use (e.g.
// move_post validating the target stage) so this doesn't fetch that table
// twice in the same request.
export async function fetchHistoryContext(supabase: SupabaseClient, stages?: Stage[]): Promise<HistoryContext> {
  const [{ data: profiles }, { data: categories }, resolvedStages] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("categories").select("id, name"),
    stages ? Promise.resolve(stages) : fetchStages(supabase),
  ]);
  return {
    profiles: (profiles ?? []).map((p: { id: string; full_name: string }) => ({ id: p.id, fullName: p.full_name })),
    categories: categories ?? [],
    stages: resolvedStages,
  };
}

// The shared org-wide Claude connector is configured with one profile's
// token — without this, every action attributes to whoever generated that
// token, not whoever's actually chatting. `actingAs` lets Claude pass along
// a name/email the person gave it (ideally asked once and remembered from
// then on) to attribute correctly instead. Self-reported, not verified —
// fine for an internal activity log, not a security boundary — so this
// always falls back to the token's own profile rather than ever erroring.
export async function resolveActingProfile(supabase: SupabaseClient, tokenProfile: Profile, actingAs?: string): Promise<Profile> {
  const needle = actingAs?.trim().toLowerCase();
  if (!needle) return tokenProfile;

  const { data } = await supabase.from("profiles").select("*");
  const match = (data ?? []).find(
    (p: { email: string; full_name: string }) => p.email.toLowerCase() === needle || p.full_name.toLowerCase() === needle,
  );
  return match ? mapProfileRow(match) : tokenProfile;
}

export async function logHistory(supabase: SupabaseClient, postId: string, actorId: string, summaries: string[]): Promise<void> {
  if (!summaries.length) return;
  const rows = summaries.map((summary) => ({ post_id: postId, actor_id: actorId, summary }));
  const { error } = await supabase.from("post_history").insert(rows);
  if (error) throw new McpToolError(`Couldn't save activity log: ${error.message}`);
}

// Board-touching tools are limited to the marketing team — everyone else's
// token can still reach submit_idea, which stays ungated.
export function assertMarketing(profile: Profile): void {
  if (!profile.isMarketing) {
    throw new McpToolError(
      "This action is limited to the marketing team. Everyone else can use submit_idea to send a post idea to marketing for review.",
    );
  }
}

export async function fetchPostByNumberOrId(
  supabase: SupabaseClient,
  { postNumber, id }: { postNumber?: number; id?: string },
): Promise<Post> {
  const query = supabase.from("posts").select(POST_SELECT);
  const { data, error } =
    postNumber != null ? await query.eq("post_number", postNumber).single() : await query.eq("id", id).single();

  if (error || !data) {
    throw new McpToolError(postNumber != null ? `No post found with number #${postNumber}.` : `No post found with id ${id}.`);
  }
  return mapPostRow(data);
}

// Mirrors addCategory's find-or-create in lib/store.tsx: a name that already
// exists (case-insensitively) is reused rather than duplicated.
export async function resolveCategoryIds(supabase: SupabaseClient, categoryNames: string[]): Promise<string[]> {
  if (categoryNames.length === 0) return [];

  const { data: existing } = await supabase.from("categories").select("id, name");
  const byLowerName = new Map((existing ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));

  const ids: string[] = [];
  for (const rawName of categoryNames) {
    const name = rawName.trim();
    if (!name) continue;
    const existingId = byLowerName.get(name.toLowerCase());
    if (existingId) {
      ids.push(existingId);
      continue;
    }
    const { data, error } = await supabase.from("categories").insert({ name }).select("id").single();
    if (error || !data) throw new McpToolError(`Couldn't create category "${name}": ${error?.message}`);
    byLowerName.set(name.toLowerCase(), data.id);
    ids.push(data.id);
  }
  return ids;
}

// Accepts either a company email or a full name (case-insensitive, partial
// match) — chat conversations naturally reference teammates by name, and
// there's no separate lookup tool to resolve one to the other first.
export async function resolveAssigneeId(supabase: SupabaseClient, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const { data, error } = await supabase.from("profiles").select("id").ilike("email", trimmed).single();
    if (error || !data) throw new McpToolError(`No team member found with email ${trimmed}.`);
    return data.id;
  }

  const { data, error } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${trimmed}%`);
  if (error) throw new McpToolError(`Couldn't look up team member "${trimmed}": ${error.message}`);
  if (!data || data.length === 0) throw new McpToolError(`No team member found matching "${trimmed}".`);
  if (data.length > 1) {
    const names = data.map((p: { full_name: string }) => p.full_name).join(", ");
    throw new McpToolError(`"${trimmed}" matches more than one teammate: ${names}. Use their full name or email to disambiguate.`);
  }
  return data[0].id;
}

// Mirrors syncPostChildren in lib/store.tsx: delete-then-reinsert per child
// table, only for the child-shaped fields actually present in the patch.
export async function syncPostChildren(
  supabase: SupabaseClient,
  postId: string,
  patch: {
    platforms?: Platform[];
    descriptions?: Record<Platform, string>;
    publishedUrls?: Partial<Record<Platform, string | null>>;
    images?: { imageUrl: string; mediaType: "image" | "video" }[];
    categoryIds?: string[];
  },
): Promise<void> {
  if (patch.platforms || patch.descriptions || patch.publishedUrls) {
    await supabase.from("post_platforms").delete().eq("post_id", postId);
    const platforms = patch.platforms ?? [];
    const descriptions = patch.descriptions ?? ({} as Record<Platform, string>);
    const publishedUrls = patch.publishedUrls ?? {};
    const rows = platforms.map((p) => ({
      post_id: postId,
      platform: p,
      description: descriptions[p] ?? "",
      published_url: publishedUrls[p] ?? null,
    }));
    if (rows.length) await supabase.from("post_platforms").insert(rows);
  }
  if (patch.images) {
    const { data: oldImages } = await supabase.from("post_images").select("image_url").eq("post_id", postId);
    await supabase.from("post_images").delete().eq("post_id", postId);

    // A removed image's file only gets deleted from storage once nothing
    // else references it — duplicated posts and promoted suggestions can
    // share the exact same URL as another row.
    const keptUrls = new Set(patch.images.map((img) => img.imageUrl));
    const removedUrls = (oldImages ?? []).map((row: { image_url: string }) => row.image_url).filter((url) => !keptUrls.has(url));
    for (const url of removedUrls) {
      const [{ count: postRefs }, { count: suggestionRefs }] = await Promise.all([
        supabase.from("post_images").select("id", { count: "exact", head: true }).eq("image_url", url),
        supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("image_url", url),
      ]);
      if ((postRefs ?? 0) > 0 || (suggestionRefs ?? 0) > 0) continue;
      const path = storagePathFromPublicUrl(url);
      if (path) await supabase.storage.from("post-media").remove([path]);
    }

    const rows = patch.images.map((img, i) => ({ post_id: postId, image_url: img.imageUrl, position: i, media_type: img.mediaType }));
    if (rows.length) await supabase.from("post_images").insert(rows);
  }
  if (patch.categoryIds) {
    await supabase.from("post_categories").delete().eq("post_id", postId);
    const rows = patch.categoryIds.map((categoryId) => ({ post_id: postId, category_id: categoryId }));
    if (rows.length) await supabase.from("post_categories").insert(rows);
  }
}

// Downloads (or decodes) an image/video and uploads it to the same
// `post-media` bucket the browser's ImageUploader writes to, using the same
// `${rowId}-${filename}` path convention.
export async function uploadPostMedia(
  supabase: SupabaseClient,
  input: { url: string } | { base64: string; filename: string },
): Promise<{ imageUrl: string; mediaType: "image" | "video" }> {
  const rowId = crypto.randomUUID();
  let buffer: Buffer;
  let filename: string;
  let contentType: string | undefined;

  if ("url" in input) {
    const res = await fetch(input.url);
    if (!res.ok) throw new McpToolError(`Couldn't download image from ${input.url} (HTTP ${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
    contentType = res.headers.get("content-type") ?? undefined;
    filename = decodeURIComponent(new URL(input.url).pathname.split("/").pop() || "image");
  } else {
    buffer = Buffer.from(input.base64, "base64");
    filename = input.filename;
  }

  const path = `${rowId}-${sanitizeFilename(filename)}`;
  const { error } = await supabase.storage.from("post-media").upload(path, buffer, contentType ? { contentType } : undefined);
  if (error) throw new McpToolError(`Couldn't upload media: ${error.message}`);

  const { data } = supabase.storage.from("post-media").getPublicUrl(path);
  const mediaType: "image" | "video" = (contentType ?? filename).includes("video") ? "video" : "image";
  return { imageUrl: data.publicUrl, mediaType };
}
