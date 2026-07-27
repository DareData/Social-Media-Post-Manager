"use client";

import { useState } from "react";
import { Globe2, MessageCircle, MoreHorizontal, Repeat2, Send, ThumbsUp } from "lucide-react";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CAPTION_PREVIEW_LIMIT } from "./captionPreview";
import { ImageCarousel } from "./ImageCarousel";
import { ImageGrid } from "./ImageGrid";
import { Lightbox } from "./Lightbox";
import { renderLinkedCaption } from "./linkify";
import type { Device } from "./device";

export function LinkedInMockup({
  post,
  description,
  device = "mobile",
}: {
  post: Post;
  description: string;
  device?: Device;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const desktop = device === "desktop";
  const video = post.images.find((img) => img.mediaType === "video");
  // The desktop feed gives a post more room before it clips, same as the real thing.
  const { node, truncated } = renderLinkedCaption(description, desktop ? null : CAPTION_PREVIEW_LIMIT.linkedin);

  return (
    <div className={cn("relative mx-auto w-full overflow-hidden rounded-lg border bg-white", desktop ? "max-w-xl" : "max-w-sm")}>
      <div className="flex items-start justify-between px-3 pt-2.5">
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[4px] bg-[#0A66C2] text-xs font-bold text-white">
            G
          </div>
          <div className="leading-tight text-neutral-900">
            <div className="text-[13px] font-semibold">GenOS</div>
            <div className="text-[11px] text-neutral-500">1,842 followers</div>
            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
              <span>{post.targetDate ?? "no date"}</span>
              <Globe2 className="size-2.5" strokeWidth={2} />
            </div>
          </div>
        </div>
        <MoreHorizontal className="size-4 text-neutral-500" />
      </div>

      <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-[13px] leading-snug text-neutral-900">
        {description ? node : "No text yet."}
        {truncated && <span className="text-neutral-500">…see more</span>}
      </p>

      {video && <ImageCarousel images={[video]} className="aspect-[1.91/1] w-full" fit="contain" />}
      {!video && post.images.length === 1 && (
        <button type="button" onClick={() => setExpandedIndex(0)} className="block w-full">
          <ImageCarousel images={post.images} className="aspect-[1.91/1] w-full" fit="contain" />
        </button>
      )}
      {!video && post.images.length > 1 && (
        <ImageGrid images={post.images} onImageClick={setExpandedIndex} className="w-full" />
      )}

      <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-[11px] text-neutral-500">
        <div className="flex -space-x-1">
          <span className="flex size-3.5 items-center justify-center rounded-full bg-[#0A66C2] ring-1 ring-white">
            <ThumbsUp className="size-2 text-white" fill="currentColor" />
          </span>
          <span className="flex size-3.5 items-center justify-center rounded-full bg-rose-500 ring-1 ring-white">
            <span className="text-[7px]">❤</span>
          </span>
        </div>
        <span>42 · 6 comments</span>
      </div>

      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="flex flex-col items-center gap-0.5 text-neutral-500">
          <ThumbsUp className="size-4" strokeWidth={1.5} />
          <span className="text-[9.5px]">Like</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-neutral-500">
          <MessageCircle className="size-4" strokeWidth={1.5} />
          <span className="text-[9.5px]">Comment</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-neutral-500">
          <Repeat2 className="size-4" strokeWidth={1.5} />
          <span className="text-[9.5px]">Repost</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-neutral-500">
          <Send className="size-4" strokeWidth={1.5} />
          <span className="text-[9.5px]">Send</span>
        </div>
      </div>

      {expandedIndex !== null && (
        <Lightbox images={post.images} initialIndex={expandedIndex} onClose={() => setExpandedIndex(null)} />
      )}
    </div>
  );
}
