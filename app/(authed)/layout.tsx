import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

// The marketing-only gate and the single StoreProvider shared by every
// authenticated route — both the dashboard views (Board/Calendar/List/...)
// and /posts/*. Those used to live in each route group's own layout, which
// meant each had its OWN StoreProvider instance: navigating from a
// dashboard view to /posts/[id] to edit a post (an extremely common click)
// unmounted one provider and mounted the other, silently re-fetching the
// entire app's data (posts, comments, history, analytics, everything) from
// scratch on what should be an ordinary in-app navigation. One shared
// instance here means that payload loads once per session, not once per
// click.
//
// proxy.ts already redirects non-marketing users away from these routes;
// this re-check is belt-and-braces so StoreProvider structurally cannot
// mount for a non-marketing session even if that first check is ever
// bypassed.
export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("is_marketing").eq("email", user.email).maybeSingle()
    : { data: null };
  if (!profile?.is_marketing) redirect("/suggest");

  return <StoreProvider>{children}</StoreProvider>;
}
