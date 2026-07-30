import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TeamNotesTab } from "./TeamNotesTab";
import { UserMenu } from "./UserMenu";
import { ViewTabs } from "./ViewTabs";
import { FilterBar } from "@/components/filters/FilterBar";

export function Header() {
  return (
    <div className="sticky top-0 z-40 bg-background/70 shadow-sm backdrop-blur-md">
      <div className="flex flex-nowrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-2xl font-bold tracking-tight sm:flex-none sm:text-4xl">
          <Image src="/buzzie-logo.png" alt="" width={58} height={44} className="shrink-0 object-contain" />
          <span>
            Bu
            <span className="inline-block text-[#d98e2c] [transform:rotate(-3deg)] dark:text-[#f0b94a]">z</span>
            <span className="inline-block text-[0.85em] text-[#d98e2c] [transform:translateY(0.02em)_rotate(-6deg)] dark:text-[#f0b94a]">Z</span>
            <span className="mx-[0.01em] inline-block text-[1.08em] text-[#d98e2c] [transform:translateY(-0.16em)_rotate(7deg)] dark:text-[#f0b94a]">z</span>
            y
          </span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <TeamNotesTab />
          <Link href="/posts/new" className={buttonVariants({ size: "lg", className: "px-2.5 text-[0.95rem] sm:px-4" })}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New post</span>
          </Link>
          <UserMenu />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3 sm:px-6 sm:pb-4">
        <ViewTabs />
        <FilterBar />
      </div>
    </div>
  );
}
