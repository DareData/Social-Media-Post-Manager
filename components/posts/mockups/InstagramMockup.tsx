import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CAPTION_PREVIEW_LIMIT, truncateCaption } from "./captionPreview";
import { ImageCarousel } from "./ImageCarousel";
import type { Device } from "./device";

export function InstagramMockup({
  post,
  description,
  device = "mobile",
}: {
  post: Post;
  description: string;
  device?: Device;
}) {
  const desktop = device === "desktop";
  const video = post.images.find((img) => img.mediaType === "video");
  // The expanded desktop modal shows the caption in full, same as the real thing.
  const { shown, truncated } = truncateCaption(description, desktop ? null : CAPTION_PREVIEW_LIMIT.instagram);

  const avatar = (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-[10px] font-bold text-white">
      G
    </div>
  );

  const media =
    post.images.length > 0 ? (
      <ImageCarousel images={post.images} className={cn("w-full", desktop ? "h-full" : "aspect-square")} />
    ) : (
      <div
        className={cn(
          "flex w-full items-center justify-center bg-gradient-to-br from-teal-500 via-sky-600 to-fuchsia-500",
          desktop ? "h-full" : "aspect-square",
        )}
      >
        <span className="px-8 text-center text-lg font-extrabold uppercase tracking-wide text-white">
          {description.slice(0, 40) || "New post"}
        </span>
      </div>
    );

  // A Reel is a single vertical video, not a swipeable multi-item post — the
  // feed layout above (square, carousel-friendly) doesn't apply to it at all.
  if (video && !desktop) {
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-lg bg-black">
        <video src={video.imageUrl} controls autoPlay loop muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pb-12 text-white">
          <div className="flex items-center gap-1.5">
            {avatar}
            <span className="text-[13px] font-semibold">genos.hq</span>
            <span className="rounded-[4px] border border-white/70 px-1.5 py-0.5 text-[10px] font-semibold">Follow</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-[12px]">
            {shown || "No caption yet."}
            {truncated && <span className="text-white/70"> … more</span>}
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-16 right-2 flex flex-col items-center gap-3.5 text-white">
          <div className="flex flex-col items-center gap-0.5">
            <Heart className="size-6" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">142</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">18</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Send className="size-6" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">4</span>
          </div>
          <MoreHorizontal className="size-5" />
        </div>
      </div>
    );
  }

  if (desktop) {
    return (
      <div className="mx-auto flex w-full max-w-2xl overflow-hidden rounded-lg border bg-white">
        <div className={cn("w-[55%] shrink-0 bg-black", video ? "aspect-[9/16]" : "aspect-square")}>
          {video ? <video src={video.imageUrl} controls autoPlay loop muted playsInline className="h-full w-full object-cover" /> : media}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2.5 text-neutral-900">
            {avatar}
            <span className="flex-1 truncate text-[13px] font-semibold">genos.hq</span>
            <span className="text-[12px] font-semibold text-sky-600">Follow</span>
            <MoreHorizontal className="size-4 shrink-0 text-neutral-500" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2.5 text-[13px] leading-snug text-neutral-900">
            <span className="font-semibold">genos.hq</span>{" "}
            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{description || "No caption yet."}</span>
            <div className="mt-2 font-mono text-[10px] uppercase text-neutral-500">
              {post.targetDate ?? "no date"}
            </div>
          </div>
          <div className="border-t px-3 pt-2.5 text-neutral-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="size-6" strokeWidth={1.5} />
                <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.5} />
                <Send className="size-6" strokeWidth={1.5} />
              </div>
              <Bookmark className="size-6" strokeWidth={1.5} />
            </div>
            <div className="py-2 text-[13px] font-semibold">142 likes</div>
          </div>
          <div className="border-t px-3 py-2.5 text-[13px] text-neutral-500">Add a comment…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 text-neutral-900">
        {avatar}
        <span className="flex-1 text-[13px] font-semibold">genos.hq</span>
        <MoreHorizontal className="size-4 text-neutral-500" />
      </div>

      {media}

      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-3">
          <Heart className="size-6" strokeWidth={1.5} />
          <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.5} />
          <Send className="size-6" strokeWidth={1.5} />
        </div>
        <Bookmark className="size-6" strokeWidth={1.5} />
      </div>

      <div className="px-3 pb-3 pt-2 text-[13px] leading-snug text-neutral-900">
        <span className="font-semibold">genos.hq</span>{" "}
        <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {shown || "No caption yet."}
        </span>
        {truncated && <span className="text-neutral-500"> … more</span>}
        <div className="mt-1 font-mono text-[10px] uppercase text-neutral-500">
          {post.targetDate ?? "no date"}
        </div>
      </div>
    </div>
  );
}
