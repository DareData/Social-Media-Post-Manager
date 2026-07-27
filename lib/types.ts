export type Platform = "linkedin" | "instagram" | "x";

export const PLATFORMS: Platform[] = ["linkedin", "instagram", "x"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
};

export const PLATFORM_LIMITS: Record<Platform, number> = {
  linkedin: 3000,
  instagram: 2200,
  x: 280,
};

// Max photos each platform accepts in a single post. Images are shared across
// every platform on a post, so the tightest of the selected platforms' limits
// is just a heads-up — it isn't enforced at upload time (see ImageUploader).
export const PLATFORM_IMAGE_LIMITS: Record<Platform, number> = {
  instagram: 20,
  linkedin: 9,
  x: 4,
};

// A post's workflow stage — a team-editable, shared list (board_stages
// table), not a fixed set. Post.status stores a Stage id.
export type PostStatus = string;

export interface Stage {
  id: string;
  label: string;
  position: number;
  requiresTargetDate: boolean;
  requiresPublishedUrl: boolean;
  blocksDelete: boolean;
  countsForMediaPurge: boolean;
  isReviewStage: boolean;
  isArchiveStage: boolean;
  locksEditing: boolean;
  isDefaultNewPostStage: boolean;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  lastReadTeamNotesAt: string | null;
  lastReadSuggestionsAt: string | null;
  isMarketing: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface PostImage {
  id: string;
  postId: string;
  imageUrl: string;
  position: number;
  mediaType: "image" | "video";
}

export interface Comment {
  id: string;
  postId: string | null; // null = general team comment, not tied to a post
  authorId: string;
  body: string;
  parentId: string | null; // the comment this one is replying to, if any
  guestName: string | null; // set when authorId is the "shared link" pseudo-profile — the name a public-link visitor typed in
  createdAt: string; // ISO datetime
}

export interface CommentReaction {
  id: string;
  commentId: string;
  authorId: string;
  emoji: string;
  createdAt: string; // ISO datetime
}

// One row per changed field per save — written by the app, never typed by a
// person (contrast with Comment). `summary` never includes caption/description
// text itself, only that it changed — see lib/postHistory.ts.
export interface PostHistoryEntry {
  id: string;
  postId: string;
  actorId: string;
  summary: string;
  createdAt: string; // ISO datetime
}

// A cached GA4 metrics row for one post+platform+day — see supabase/post-analytics-content.sql
export interface PostAnalytics {
  postId: string;
  platform: Platform;
  date: string; // ISO date (yyyy-mm-dd)
  content: string; // utm_content value; "" = the plain caption link, no placement tag set
  site: string; // which site's GA4 property this came from (e.g. "Daredata"/"GenOS"); "" if unknown
  sessions: number;
  users: number;
  newUsers: number; // GA4 "newUsers" — first-ever session in the date range
  pageViews: number;
  engagedSessions: number;
  engagementRate: number | null; // 0-1 fraction, as GA4 returns it
  avgEngagementTime: number | null; // seconds
  bounceRate: number | null; // 0-1 fraction
  conversions: number; // GA4 "conversions" — count of key events, if any are configured on the property
  updatedAt: string; // ISO datetime — when this row was last synced from GA4
}

// Device/country breakdown for one post+platform+day — see
// supabase/post-analytics-geo.sql. Kept separate from PostAnalytics
// (per-placement rows) so this dimension doesn't multiply that table.
export interface PostAnalyticsGeo {
  postId: string;
  platform: Platform;
  date: string; // ISO date (yyyy-mm-dd)
  deviceCategory: string; // "mobile" | "desktop" | "tablet" | "(not set)"
  country: string; // country name, or "Other" once past the campaign's top 5
  sessions: number;
  users: number;
  updatedAt: string; // ISO datetime — when this row was last synced from GA4
}

export type SuggestionStatus = "new" | "accepted" | "dismissed";

export interface Suggestion {
  id: string;
  submittedBy: string;
  description: string;
  imageUrl: string | null;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resultingPostId: string | null;
  createdAt: string;
}

export interface Post {
  id: string;
  postNumber: number;
  platforms: Platform[];
  title: string; // short internal label, just for scanning the tracker — never posted, no character limit
  descriptions: Record<Platform, string>; // the actual post copy per platform — character-limited per platform
  status: PostStatus;
  targetDate: string | null; // ISO date (yyyy-mm-dd)
  needsChanges: boolean;
  needsChangesSetAt: string | null; // ISO datetime — when needsChanges last became true, so the UI can tell which comment (if any) explains why
  publishedUrls: Record<Platform, string | null>; // the live link per platform, once that platform's copy actually goes out
  assigneeId: string | null;
  requestedById: string | null;
  createdBy: string;
  categoryIds: string[];
  images: PostImage[];
  keepMedia: boolean; // opts this post's photos/videos out of the 90-day auto-purge
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
}
