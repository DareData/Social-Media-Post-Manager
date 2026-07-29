import { useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { ImageOff, Play } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlatformBadgeGroup } from "@/components/posts/PlatformBadge";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOUBLE_CLICK_MS = 250;

export function PostCard({ post, index }: { post: Post; index: number }) {
  const { profiles, categories, comments, openPreview } = useStore();
  const router = useRouter();
  // Opening the preview is delayed slightly so a second click can cancel it
  // and navigate to the edit page instead — without the delay, the first
  // click's modal would already be open by the time the second click lands,
  // so it'd hit the modal's backdrop (closing it) rather than the card.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      router.push(`/posts/${post.id}`);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      openPreview(post.id);
    }, DOUBLE_CLICK_MS);
  };
  const assignee = profiles.find((p) => p.id === post.assigneeId);
  const postCategories = categories.filter((c) => post.categoryIds.includes(c.id));
  // The "reason" for Changes Requested is whatever comment was left after
  // the flag went up — not just the latest comment on the post (that could
  // predate this round of feedback entirely, or be unrelated small talk).
  const changeReason =
    post.needsChanges && post.needsChangesSetAt
      ? comments
          .filter((c) => c.postId === post.id && c.createdAt >= post.needsChangesSetAt!)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
  // A past target date only means something's late if it hasn't shipped yet —
  // Scheduled/Published posts are supposed to have a date in the past by then.
  const isOverdue =
    post.targetDate !== null &&
    post.targetDate < format(new Date(), "yyyy-MM-dd") &&
    post.status !== "scheduled" &&
    post.status !== "published";

  return (
    <Draggable draggableId={post.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleClick}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-lg bg-background p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_16px_-4px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_16px_28px_-6px_rgba(0,0,0,0.18)]",
            snapshot.isDragging && "ring-2 ring-primary/40",
          )}
        >
          <div className="mb-2.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <PlatformBadgeGroup platforms={post.platforms} />
            </div>
            {post.needsChanges &&
              (changeReason ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge
                        variant="outline"
                        className="cursor-help border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400 font-mono text-[10px] font-semibold uppercase tracking-wide"
                      />
                    }
                  >
                    Changes
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">{changeReason.body}</TooltipContent>
                </Tooltip>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400 font-mono text-[10px] font-semibold uppercase tracking-wide"
                >
                  Changes
                </Badge>
              ))}
          </div>

          {post.images.length > 0 ? (
            post.images[0].mediaType === "video" ? (
              <div className="relative mb-2.5 h-24 w-full overflow-hidden rounded-md bg-muted">
                <video src={post.images[0].imageUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="size-5 fill-white text-white" />
                </span>
              </div>
            ) : (
              <div className="relative mb-2.5 h-24 w-full overflow-hidden rounded-md bg-muted">
                <Image src={post.images[0].imageUrl} alt="" fill sizes="240px" className="object-cover" />
              </div>
            )
          ) : (
            <div className="mb-2.5 flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 text-muted-foreground">
              <ImageOff className="size-4" />
              <span className="text-[10px]">No image yet</span>
            </div>
          )}

          <p className="mb-2.5 line-clamp-2 text-sm font-medium leading-snug">{post.title}</p>

          <div className="flex items-center justify-between gap-2">
            {postCategories.length > 0 ? (
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {postCategories[0].name}
                </span>
                {postCategories.length > 1 && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">+{postCategories.length - 1}</span>
                )}
              </div>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              {assignee && (
                <Avatar size="sm" title={assignee.fullName}>
                  <AvatarFallback className="text-[10px]">{assignee.initials}</AvatarFallback>
                </Avatar>
              )}
              <span className={cn("text-xs font-medium", isOverdue ? "font-semibold text-red-600" : "text-muted-foreground")}>
                {post.targetDate ? format(new Date(`${post.targetDate}T00:00:00`), "MMM d") : "No date"}
              </span>
            </div>
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground/70">id: #{post.postNumber}</p>
        </div>
      )}
    </Draggable>
  );
}
