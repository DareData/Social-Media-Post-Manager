"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/posts/PlatformBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { extractAllUtmInfo } from "@/lib/utmCampaign";
import type { Platform } from "@/lib/types";

interface UtmRow {
  postId: string;
  postNumber: number;
  title: string;
  platform: Platform;
  url: string;
  campaign: string | null;
  content: string | null;
}

interface UtmTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Every UTM-tagged link currently sitting in a post's caption, across the
// whole board — there's nowhere else to see this at a glance, since the
// tag itself just lives as plain text inside each platform's description.
export function UtmTagsModal({ open, onOpenChange }: UtmTagsModalProps) {
  const { posts, openPreview } = useStore();

  const rows = useMemo<UtmRow[]>(() => {
    const result: UtmRow[] = [];
    for (const post of posts) {
      if (post.deletedAt) continue;
      for (const platform of post.platforms) {
        const links = extractAllUtmInfo(post.descriptions[platform] ?? "");
        for (const info of links) {
          result.push({
            postId: post.id,
            postNumber: post.postNumber,
            title: post.title || "Untitled post",
            platform,
            url: info.url,
            campaign: info.campaign,
            content: info.content,
          });
        }
      }
    }
    return result.sort((a, b) => b.postNumber - a.postNumber);
  }, [posts]);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>UTM tags</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 border-t px-4 pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tagged links yet — use the &quot;Transform with UTM tags&quot; hint in a post&apos;s description to add one.
            </p>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {rows.map((row) => (
                <div key={`${row.postId}|${row.platform}|${row.url}`} className="flex flex-col gap-1.5 rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        openPreview(row.postId);
                      }}
                      className="flex min-w-0 items-center gap-2 text-left hover:underline"
                    >
                      <PlatformBadge platform={row.platform} />
                      <span className="truncate text-sm font-medium">
                        #{row.postNumber} {row.title}
                      </span>
                    </button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => copyLink(row.url)} title="Copy link">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Campaign: <span className="font-medium text-foreground">{row.campaign ?? "—"}</span>
                    </span>
                    <span>
                      Content: <span className="font-medium text-foreground">{row.content || "caption link"}</span>
                    </span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground/70">{row.url}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
