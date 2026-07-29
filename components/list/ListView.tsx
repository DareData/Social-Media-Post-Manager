"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowUpDown, CalendarDays, ChevronDown, FileText, GripVertical, ImageOff, Pencil, Play, Radio, Tag, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlatformBadgeGroup } from "@/components/posts/PlatformBadge";
import { PublishedUrlDialog } from "@/components/board/PublishedUrlDialog";
import { ScheduleDateDialog } from "@/components/board/ScheduleDateDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { needsChangesPatch } from "@/lib/stageRules";
import { useStore } from "@/lib/store";
import type { Post, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const GRID_COLS = "grid-cols-[48px_1fr_190px_160px_110px_160px_32px]";

const SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "targetDate", label: "Publish date" },
  { value: "createdAt", label: "Created on" },
  { value: "updatedAt", label: "Last modified" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const SORTERS: Record<SortKey, (a: Post, b: Post) => number> = {
  default: () => 0,
  alphabetical: (a, b) => (a.title || "Untitled post").localeCompare(b.title || "Untitled post"),
  targetDate: (a, b) => (a.targetDate ?? "9999-99-99").localeCompare(b.targetDate ?? "9999-99-99"),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  updatedAt: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

export function ListView() {
  const { filteredPosts, profiles, categories, stages, comments, openPreview, movePost, getPostById, updateStage, reorderStages } = useStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<PostStatus>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingSchedule, setPendingSchedule] = useState<{ postId: string; status: PostStatus; index: number } | null>(null);
  const [pendingPublish, setPendingPublish] = useState<{ postId: string; status: PostStatus; index: number } | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");
  // Opening the preview is delayed slightly so a second click can cancel it
  // and navigate to the edit page instead — without the delay, the first
  // click's modal would already be open by the time the second click lands,
  // so it'd hit the modal's backdrop (closing it) rather than the row.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowClick = (postId: string) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      router.push(`/posts/${postId}`);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      openPreview(postId);
    }, 250);
  };

  const stageById = (id: string) => stages.find((s) => s.id === id);

  const toggleCollapsed = (status: PostStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const startRename = (stage: { id: string; label: string }) => {
    setRenamingId(stage.id);
    setRenameDraft(stage.label);
  };

  const commitRename = () => {
    const trimmed = renameDraft.trim();
    const id = renamingId;
    setRenamingId(null);
    if (!id || !trimmed) return;
    const stage = stageById(id);
    if (stage && trimmed !== stage.label) updateStage(id, { label: trimmed });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "COLUMN") {
      const reordered = [...stages];
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      reorderStages(reordered.map((s) => s.id));
      return;
    }

    const newStatus = destination.droppableId as PostStatus;
    const post = getPostById(draggableId);
    const targetStage = stageById(newStatus);
    if (!post || !targetStage) return;

    if (targetStage.requiresTargetDate && !post.targetDate) {
      setPendingSchedule({ postId: draggableId, status: newStatus, index: destination.index });
      return;
    }

    if (targetStage.requiresPublishedUrl && post.platforms.some((p) => !post.publishedUrls[p])) {
      setPendingPublish({ postId: draggableId, status: newStatus, index: destination.index });
      return;
    }

    const oldStage = stageById(post.status);
    movePost(draggableId, newStatus, destination.index, oldStage ? needsChangesPatch(oldStage, targetStage) : {});
  };

  if (filteredPosts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No posts match these filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 self-end">
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger size="sm" className="min-w-40">
            <SelectValue>{(value: SortKey) => SORT_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className={cn("grid min-w-[760px] px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground/70", GRID_COLS)}>
        <span className="sticky left-0 z-10 col-span-2 flex items-center gap-1 border-r bg-canvas pr-2"><FileText className="size-3" />Post</span>
        <span className="flex items-center gap-1 border-l px-3"><Radio className="size-3" />Platform</span>
        <span className="flex items-center gap-1 border-l px-3"><UserRound className="size-3" />Assignee</span>
        <span className="flex items-center gap-1 border-l px-3"><CalendarDays className="size-3" />Date</span>
        <span className="flex items-center gap-1 border-l px-3"><Tag className="size-3" />Category</span>
        <span className="border-l" />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="list-stages" direction="vertical" type="COLUMN">
          {(stagesProvided) => (
            <div ref={stagesProvided.innerRef} {...stagesProvided.droppableProps} className="flex flex-col gap-4">
              {stages.map((stage, stageIndex) => {
                const rows = filteredPosts.filter((p) => p.status === stage.id).sort(SORTERS[sortKey]);
                const isCollapsed = collapsed.has(stage.id);
                const isRenaming = renamingId === stage.id;

                return (
                  <Draggable key={stage.id} draggableId={`column-${stage.id}`} index={stageIndex}>
                    {(stageDragProvided) => (
                      <div ref={stageDragProvided.innerRef} {...stageDragProvided.draggableProps} className="flex flex-col gap-2">
                        <div className="group flex w-fit items-center gap-1.5">
                          <span
                            {...stageDragProvided.dragHandleProps}
                            aria-label={`Reorder ${stage.label}`}
                            title="Drag to reorder"
                            className="flex size-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                          >
                            <GripVertical className="size-3.5" />
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleCollapsed(stage.id)}
                            aria-label="Toggle stage"
                            className="flex items-center"
                          >
                            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                          </button>
                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="rounded-md bg-muted px-1.5 py-0.5 text-base font-semibold text-foreground outline-none ring-1 ring-primary"
                            />
                          ) : (
                            <span
                              onClick={() => startRename(stage)}
                              title="Click to rename"
                              className="cursor-text rounded-md px-1.5 py-0.5 text-base font-semibold hover:bg-muted"
                            >
                              {stage.label}
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                              stage.isArchiveStage
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                : stage.isReviewStage
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {rows.length}
                          </span>
                        </div>
                        {!isCollapsed && (
                          <div className="flex flex-col gap-2">
                            <div className="h-px bg-border" />
                            <Droppable droppableId={stage.id}>
                              {(rowsProvided, rowsSnapshot) => (
                                <div
                                  ref={rowsProvided.innerRef}
                                  {...rowsProvided.droppableProps}
                                  className={cn(
                                    "min-w-[760px] rounded-lg bg-background shadow-sm",
                                    rowsSnapshot.isDraggingOver && "ring-2 ring-primary/30",
                                  )}
                                >
                                  {rows.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-muted-foreground">No posts in this stage.</p>
                                  ) : (
                                    rows.map((post, rowIndex) => {
                                      const assignee = profiles.find((p) => p.id === post.assigneeId);
                                      const postCategories = categories.filter((c) => post.categoryIds.includes(c.id));
                                      const cover = post.images[0];
                                      const isOverdue =
                                        post.targetDate !== null &&
                                        post.targetDate < today &&
                                        !stage.requiresPublishedUrl &&
                                        !stage.locksEditing;
                                      // Same "reason" logic as the board card — only a comment left
                                      // after the flag went up counts, not just whatever's newest.
                                      const changeReason =
                                        post.needsChanges && post.needsChangesSetAt
                                          ? comments
                                              .filter((c) => c.postId === post.id && c.createdAt >= post.needsChangesSetAt!)
                                              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
                                          : undefined;

                                      return (
                                        <Draggable key={post.id} draggableId={post.id} index={rowIndex}>
                                          {(postDragProvided, postDragSnapshot) => (
                                            <div
                                              ref={postDragProvided.innerRef}
                                              {...postDragProvided.draggableProps}
                                              {...postDragProvided.dragHandleProps}
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => handleRowClick(post.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  openPreview(post.id);
                                                }
                                              }}
                                              className={cn(
                                                "group grid w-full cursor-pointer items-center border-b px-4 py-2 text-left text-sm last:border-b-0 hover:bg-muted/40",
                                                GRID_COLS,
                                                isOverdue && "bg-red-50 dark:bg-red-950/30",
                                                postDragSnapshot.isDragging && "bg-background shadow-lg ring-2 ring-primary/40",
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "sticky left-0 z-10 col-span-2 flex min-w-0 items-center gap-2 border-r pr-3",
                                                  isOverdue && !postDragSnapshot.isDragging ? "bg-red-50 dark:bg-red-950/30" : "bg-background",
                                                )}
                                              >
                                                <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                                                  {cover ? (
                                                    cover.mediaType === "video" ? (
                                                      <span className="relative flex h-full w-full items-center justify-center bg-black/10">
                                                        <Play className="size-3.5 fill-foreground/70 text-foreground/70" />
                                                      </span>
                                                    ) : (
                                                      <Image src={cover.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                                                    )
                                                  ) : (
                                                    <ImageOff className="size-3.5" />
                                                  )}
                                                </span>
                                                <span className="flex min-w-0 items-center gap-2">
                                                  <span className="truncate font-medium">{post.title || "Untitled post"}</span>
                                                  {post.needsChanges && (
                                                    <span
                                                      className="size-2.5 shrink-0 rounded-full bg-amber-500"
                                                      title={changeReason ? `Needs changes: ${changeReason.body}` : "Needs changes"}
                                                    />
                                                  )}
                                                </span>
                                              </span>
                                              <span className="min-w-0 border-l px-3">
                                                <PlatformBadgeGroup platforms={post.platforms} />
                                              </span>
                                              <span className="flex items-center gap-1.5 truncate border-l px-3 text-muted-foreground">
                                                {assignee ? (
                                                  <>
                                                    <Avatar size="sm" title={assignee.fullName}>
                                                      <AvatarFallback className="text-[9px]">{assignee.initials}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate">{assignee.fullName}</span>
                                                  </>
                                                ) : (
                                                  "Unassigned"
                                                )}
                                              </span>
                                              <span className={cn("border-l px-3", isOverdue ? "font-semibold text-red-600" : "text-muted-foreground")}>
                                                {post.targetDate ? format(new Date(`${post.targetDate}T00:00:00`), "MMM d") : "—"}
                                              </span>
                                              <span className="truncate border-l px-3 text-muted-foreground">
                                                {postCategories.length > 0 ? postCategories.map((c) => c.name).join(", ") : "—"}
                                              </span>
                                              <Link
                                                href={`/posts/${post.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Edit post"
                                                title="Edit post"
                                                className="flex size-7 shrink-0 items-center justify-center rounded-md border-l text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                                              >
                                                <Pencil className="size-3.5" />
                                              </Link>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })
                                  )}
                                  {rowsProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {stagesProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      </div>

      <ScheduleDateDialog
        open={pendingSchedule !== null}
        onCancel={() => setPendingSchedule(null)}
        onConfirm={(date) => {
          if (!pendingSchedule) return;
          const post = getPostById(pendingSchedule.postId);
          const oldStage = post ? stageById(post.status) : undefined;
          const newStage = stageById(pendingSchedule.status);
          movePost(pendingSchedule.postId, pendingSchedule.status, pendingSchedule.index, {
            targetDate: date,
            ...(oldStage && newStage ? needsChangesPatch(oldStage, newStage) : {}),
          });
          setPendingSchedule(null);
        }}
      />

      <PublishedUrlDialog
        open={pendingPublish !== null}
        platforms={(pendingPublish && getPostById(pendingPublish.postId)?.platforms) ?? []}
        initialUrls={(pendingPublish && getPostById(pendingPublish.postId)?.publishedUrls) ?? {}}
        onCancel={() => setPendingPublish(null)}
        onSkip={() => {
          if (!pendingPublish) return;
          const post = getPostById(pendingPublish.postId);
          const oldStage = post ? stageById(post.status) : undefined;
          const newStage = stageById(pendingPublish.status);
          movePost(pendingPublish.postId, pendingPublish.status, pendingPublish.index, {
            ...(oldStage && newStage ? needsChangesPatch(oldStage, newStage) : {}),
          });
          setPendingPublish(null);
        }}
        onConfirm={(urls) => {
          if (!pendingPublish) return;
          const post = getPostById(pendingPublish.postId);
          const oldStage = post ? stageById(post.status) : undefined;
          const newStage = stageById(pendingPublish.status);
          movePost(pendingPublish.postId, pendingPublish.status, pendingPublish.index, {
            publishedUrls: { ...(post?.publishedUrls ?? { linkedin: null, instagram: null, x: null }), ...urls },
            ...(oldStage && newStage ? needsChangesPatch(oldStage, newStage) : {}),
          });
          setPendingPublish(null);
        }}
      />
    </div>
  );
}
