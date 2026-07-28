"use client";

import { useState } from "react";
import { BarChart2, Heart, MessageCircle, MoreHorizontal, Repeat2, Share } from "lucide-react";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageCarousel } from "./ImageCarousel";
import { ImageGrid } from "./ImageGrid";
import { Lightbox } from "./Lightbox";
import { renderLinkedCaption } from "./linkify";
import type { Device } from "./device";

export function XMockup({
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
  const { node } = renderLinkedCaption(description, null);

  return (
    <div className={cn("relative mx-auto w-full overflow-hidden rounded-lg border bg-white", desktop ? "max-w-xl" : "max-w-sm")}>
      <div className="px-3 pt-2.5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
              G
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1 text-[13px] text-neutral-900">
                <span className="font-bold">GenOS</span>
                <span className="text-neutral-500">@genos_hq</span>
                <span className="text-neutral-500">· {post.targetDate ?? "now"}</span>
              </div>
            </div>
          </div>
          <MoreHorizontal className="size-4 text-neutral-500" />
        </div>

        <p className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere] pb-2.5 text-[14px] leading-snug text-neutral-900">
          {description ? node : "No text yet."}
        </p>
      </div>

      {video && (
        <ImageCarousel images={[video]} className="mx-3 mb-3 aspect-video w-[calc(100%-1.5rem)] rounded-xl border" fit="contain" />
      )}
      {!video && post.images.length === 1 && (
        <button type="button" onClick={() => setExpandedIndex(0)} className="mx-3 mb-3 block w-[calc(100%-1.5rem)]">
          <ImageCarousel images={post.images} className="aspect-video w-full rounded-xl border" fit="contain" />
        </button>
      )}
      {!video && post.images.length > 1 && (
        <ImageGrid
          images={post.images}
          onImageClick={setExpandedIndex}
          quadAsGrid
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border"
        />
      )}

      <div className="flex items-center justify-between border-t px-4 py-2 text-neutral-500">
        <div className="flex items-center gap-1">
          <MessageCircle className="size-4" strokeWidth={1.5} />
          <span className="text-[10.5px]">18</span>
        </div>
        <div className="flex items-center gap-1">
          <Repeat2 className="size-4" strokeWidth={1.5} />
          <span className="text-[10.5px]">4</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart className="size-4" strokeWidth={1.5} />
          <span className="text-[10.5px]">96</span>
        </div>
        <div className="flex items-center gap-1">
          <BarChart2 className="size-4" strokeWidth={1.5} />
          <span className="text-[10.5px]">2.1K</span>
        </div>
        <Share className="size-4" strokeWidth={1.5} />
      </div>

      {expandedIndex !== null && (
        <Lightbox images={post.images} initialIndex={expandedIndex} onClose={() => setExpandedIndex(null)} />
      )}
    </div>
  );
}
