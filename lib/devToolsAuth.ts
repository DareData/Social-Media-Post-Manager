import { createClient } from "@/lib/supabase/server";

// Shared guard for every /api/dev-tools/* route — mirrors the is_marketing
// check in app/(authed)/layout.tsx, since these routes are only ever
// called from UI that's already gated the same way, but shouldn't trust that
// alone (a saved bearer/session could still call the route directly).
export async function requireMarketingSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("is_marketing").eq("email", user.email).maybeSingle();
  if (!profile?.is_marketing) return null;

  return { supabase, user };
}
