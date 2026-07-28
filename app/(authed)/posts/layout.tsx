import type { ReactNode } from "react";
import { AppBackground } from "@/components/layout/AppBackground";

// The marketing-only auth check and the StoreProvider both live one level
// up now, in app/(authed)/layout.tsx — see that file for why.
export default function PostsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppBackground />
      <div className="min-h-screen px-6 py-10">{children}</div>
    </>
  );
}
