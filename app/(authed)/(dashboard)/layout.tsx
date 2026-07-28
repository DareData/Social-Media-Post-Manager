import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { PostPreviewModal } from "@/components/posts/PostPreviewModal";

// The marketing-only auth check and the StoreProvider both live one level
// up now, in app/(authed)/layout.tsx — shared with the posts/ route group
// so navigating between "the board" and "editing a post" doesn't remount
// the store and refetch everything. See that file for the full reasoning.
//
// PostPreviewModal still lives here (not in the shared layout) because
// it's dashboard-specific UI — /posts/[id] has its own full-page edit
// view, it doesn't need the preview overlay too.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">{children}</main>
      <PostPreviewModal />
    </div>
  );
}
