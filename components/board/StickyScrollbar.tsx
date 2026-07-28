"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// A second horizontal scrollbar, pinned to the bottom of the viewport and
// synced with the real one — so scrolling between board columns stays
// reachable even when a column's height pushes the real scrollbar far down
// the page. Columns keep their natural height; nothing else changes.
export function StickyScrollbar({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const updateWidth = () => setContentWidth(target.scrollWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  useEffect(() => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;

    // Equal-value guards (not a sync flag) break the ping-pong: the second
    // hop is a no-op because the values already match by then.
    const onTargetScroll = () => {
      if (track.scrollLeft !== target.scrollLeft) track.scrollLeft = target.scrollLeft;
    };
    const onTrackScroll = () => {
      if (target.scrollLeft !== track.scrollLeft) target.scrollLeft = track.scrollLeft;
    };

    target.addEventListener("scroll", onTargetScroll);
    track.addEventListener("scroll", onTrackScroll);
    return () => {
      target.removeEventListener("scroll", onTargetScroll);
      track.removeEventListener("scroll", onTrackScroll);
    };
  }, [targetRef]);

  return (
    <div
      ref={trackRef}
      className="board-sticky-scrollbar sticky bottom-0 z-30 hidden h-3.5 overflow-x-auto overflow-y-hidden border-t bg-background md:block"
      aria-hidden
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  );
}
