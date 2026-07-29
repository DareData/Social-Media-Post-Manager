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
        <h1 className="relative flex min-w-0 flex-1 items-center gap-2 truncate text-xl font-bold tracking-tight sm:flex-none sm:text-3xl">
          <Image src="/buzzie-logo.png" alt="" width={34} height={40} className="shrink-0 object-contain" />
          Buzzie
          {/* A few scattered "pollen" dots, echoing the ones floating around
              the bee in the source artwork — purely decorative, kept small
              and sparse so it reads as texture, not clutter. */}
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            <span className="absolute left-[30%] bottom-1 size-[3px] rounded-full bg-[#c8890a]/50" />
            <span className="absolute left-[38%] top-0 size-1 rounded-full bg-[#c8890a]/70" />
            <span className="absolute left-[46%] top-1 size-[3px] rounded-full bg-[#c8890a]/40" />
            <span className="absolute left-[52%] bottom-0.5 size-[3px] rounded-full bg-[#c8890a]/50" />
            <span className="absolute left-[62%] bottom-1.5 size-1 rounded-full bg-[#c8890a]/45" />
            <span className="absolute left-[70%] top-0.5 size-[3px] rounded-full bg-[#c8890a]/60" />
            <span className="absolute left-[78%] top-0 size-[3px] rounded-full bg-[#c8890a]/50" />
            <span className="absolute left-[85%] bottom-1 size-1 rounded-full bg-[#c8890a]/40" />
            <span className="absolute left-[92%] top-1 size-[3px] rounded-full bg-[#c8890a]/55" />
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
