"use client";

import Image from "next/image";
import { format } from "date-fns";
import { ExternalLink, Play } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlatformBadgeGroup } from "@/components/posts/PlatformBadge";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";

interface MonthGroup {
  label: string;
  items: Post[];
}

function monthLabel(post: Post): string {
  if (!post.targetDate) return "No date";
  return format(new Date(`${post.targetDate}T00:00:00`), "MMMM yyyy");
}

// Posts arrive already sorted newest-first (with "no date" posts trailing at
// the end) — grouping just has to fold consecutive same-label runs together.
function groupByMonth(posts: Post[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const post of posts) {
    const label = monthLabel(post);
    const current = groups[groups.length - 1];
    if (current?.label === label) current.items.push(post);
    else groups.push({ label, items: [post] });
  }
  return groups;
}

export function ArchiveView() {
  const { filteredPosts, openPreview, profiles, stages } = useStore();
  const archiveStageIds = new Set(stages.filter((s) => s.isArchiveStage).map((s) => s.id));
  const published = filteredPosts
    .filter((p) => archiveStageIds.has(p.status))
    .sort((a, b) => {
      if (!a.targetDate && !b.targetDate) return b.createdAt.localeCompare(a.createdAt);
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return b.targetDate.localeCompare(a.targetDate);
    });

  if (published.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No published posts match these filters yet.
      </div>
    );
  }

  const groups = groupByMonth(published);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {published.length} post{published.length === 1 ? "" : "s"} published
      </p>

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
            {group.items.map((post) => {
              const cover = post.images[0];
              const assignee = profiles.find((p) => p.id === post.assigneeId);
              // Several platforms can each have their own link — the compact
              // thumbnail only has room for one, so just surface the first.
              const firstPublishedUrl = post.platforms.map((p) => post.publishedUrls[p]).find(Boolean);
              return (
                <div
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPreview(post.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPreview(post.id);
                    }
                  }}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-background text-left transition-shadow hover:shadow-md"
                >
                  {cover && (
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {cover.mediaType === "video" ? (
                        <video src={cover.imageUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                      ) : (
                        <Image
                          src={cover.imageUrl}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 200px, 50vw"
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      {cover.mediaType === "video" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <Play className="size-6 fill-white text-white" />
                        </span>
                      )}
                      {firstPublishedUrl && (
                        <a
                          href={firstPublishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Open the published post"
                          title="Open the published post"
                          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 p-1.5">
                    <PlatformBadgeGroup platforms={post.platforms} />
                    <p className="line-clamp-2 text-xs font-medium leading-snug">{post.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] text-muted-foreground">{post.targetDate ?? "no date"}</span>
                      {assignee && (
                        <Avatar size="sm" title={assignee.fullName}>
                          <AvatarFallback className="text-[8px]">{assignee.initials}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
