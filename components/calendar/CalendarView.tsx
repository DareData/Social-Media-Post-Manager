"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PLATFORM_BG_CLASSES, PlatformBadge, PlatformBadgeGroup } from "@/components/posts/PlatformBadge";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView() {
  const router = useRouter();
  const { filteredPosts, openPreview, profiles, stages, addPost, updatePost, weekStartsOn } = useStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  // Weekday columns reordered to match the chosen start day, rather than
  // always rendering Sun-first and just changing which days are grouped.
  const orderedWeekdays = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  // Opening the preview is delayed slightly so a second click can cancel it
  // and navigate to the edit page instead — without the delay, the first
  // click's modal would already be open by the time the second click lands,
  // so it'd hit the modal's backdrop (closing it) rather than the entry.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePostClick = (postId: string) => {
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

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const postsForDay = (day: Date) =>
    filteredPosts.filter(
      // Appending a local time avoids the browser parsing the date-only
      // string as UTC midnight, which shifts it a day earlier in timezones
      // behind UTC.
      (post) => post.targetDate && isSameDay(new Date(`${post.targetDate}T00:00:00`), day),
    );

  const selectedDayPosts = selectedDay ? postsForDay(selectedDay) : [];

  // Dropping a post onto a different day reschedules it — the droppableId
  // for each day cell is just its ISO date, so the drop target *is* the new
  // targetDate, no lookup needed.
  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || destination.droppableId === result.source.droppableId) return;
    updatePost(draggableId, { targetDate: destination.droppableId });
  };

  const handleAddDraft = () => {
    if (!selectedDay) return;
    const draft = addPost({
      platforms: ["linkedin"],
      title: "",
      descriptions: { linkedin: "", instagram: "", x: "" },
      status: stages.find((s) => s.isDefaultNewPostStage)?.id ?? stages[0]?.id ?? "backlog",
      targetDate: format(selectedDay, "yyyy-MM-dd"),
      needsChanges: false,
      needsChangesSetAt: null,
      keepMedia: false,
      publishedUrls: { linkedin: null, instagram: null, x: null },
      assigneeId: null,
      requestedById: null,
      categoryIds: [],
      images: [],
    });
    setSelectedDay(null);
    router.push(`/posts/${draft.id}`);
  };

  return (
    <div className="overflow-hidden rounded-lg bg-background shadow-md">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-2xl font-bold tracking-tight">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <Button size="default" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor((d) => subMonths(d, 1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor((d) => addMonths(d, 1))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b">
        {orderedWeekdays.map((dow) => (
          <div
            key={dow}
            className={cn(
              "px-2.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground/70",
              (dow === 0 || dow === 6) && "bg-muted/50",
            )}
          >
            {WEEKDAY_LABELS[dow]}
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayPosts = postsForDay(day);
            const inMonth = isSameMonth(day, cursor);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dayKey = format(day, "yyyy-MM-dd");

            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDay(day)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDay(day);
                  }
                }}
                className={cn(
                  "border-b border-r p-2 last:border-r-0 hover:bg-muted/40",
                  (!inMonth || isWeekend) && "bg-muted/50",
                )}
              >
                <Droppable droppableId={dayKey}>
                  {(dropProvided, dropSnapshot) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className={cn(
                        "flex min-h-[124px] cursor-pointer flex-col gap-1.5 rounded-md",
                        dropSnapshot.isDraggingOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold text-foreground/80",
                          !inMonth && "text-muted-foreground/50",
                          isToday(day) &&
                            "flex h-6 w-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="flex flex-col gap-1">
                        {dayPosts.map((post, index) => (
                          <Draggable key={post.id} draggableId={post.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <button
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePostClick(post.id);
                                }}
                                className={cn(
                                  "flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-xs hover:brightness-95",
                                  PLATFORM_BG_CLASSES[post.platforms[0]],
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40",
                                )}
                                title={post.title}
                              >
                                <PlatformBadge
                                  platform={post.platforms[0]}
                                  className="bg-transparent px-1 py-0 gap-1 shrink-0"
                                  labelClassName="hidden sm:inline"
                                />
                                {post.platforms.length > 1 && (
                                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground" title={`Also on ${post.platforms.length - 1} more platform${post.platforms.length > 2 ? "s" : ""}`}>
                                    +{post.platforms.length - 1}
                                  </span>
                                )}
                                {post.needsChanges && (
                                  <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title="Needs changes" />
                                )}
                                <span className="truncate">{post.title}</span>
                              </button>
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={Boolean(selectedDay)} onOpenChange={(next) => !next && setSelectedDay(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDay ? format(selectedDay, "EEEE, MMMM d") : ""}</DialogTitle>
          </DialogHeader>
          <Button type="button" onClick={handleAddDraft} className="w-full">
            <Plus className="size-4" />
            Add post draft
          </Button>
          <div className="flex flex-col gap-2">
            {selectedDayPosts.length === 0 && (
              <p className="text-sm text-muted-foreground">No posts scheduled for this day.</p>
            )}
            {selectedDayPosts.map((post) => {
              const assignee = profiles.find((p) => p.id === post.assigneeId);
              const statusLabel = stages.find((s) => s.id === post.status)?.label;
              return (
                <button
                  key={post.id}
                  onClick={() => {
                    setSelectedDay(null);
                    handlePostClick(post.id);
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PlatformBadgeGroup platforms={post.platforms} />
                    <span className="truncate text-sm font-medium">{post.title || "Untitled post"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {assignee && (
                      <Avatar size="sm" title={assignee.fullName}>
                        <AvatarFallback className="text-[9px]">{assignee.initials}</AvatarFallback>
                      </Avatar>
                    )}
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
                      {statusLabel}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
