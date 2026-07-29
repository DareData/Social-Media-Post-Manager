import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/mcp authenticates itself via a bearer token (api_tokens table), not a
// cookie session; /api/cron is invoked by Vercel's scheduler (no session at
// all) and checks its own CRON_SECRET bearer token instead. /p and
// /api/public are the shared, no-login post link — deliberately open to
// anyone with the URL, scoped server-side to a single post id (see
// app/api/public/posts/[id]/route.ts).
// /robots.txt has to be reachable by anonymous crawlers to do anything —
// redirecting them to /login instead defeats the whole point of it.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/mcp", "/api/cron", "/p/", "/api/public", "/robots.txt"];
// Open to every signed-in employee regardless of role — everything else is
// marketing-only by default, so a future new page is safe unless explicitly
// added here.
const EVERYONE_PATHS = ["/suggest"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname !== "/auth/callback" && request.nextUrl.pathname !== "/api/mcp") {
    const isEveryonePath = EVERYONE_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

    // ?preview=1 lets a signed-in dev open /login from the Dev Tools panel to
    // actually look at it, instead of always bouncing to /board — the page
    // itself has nothing sensitive to protect either way.
    if (request.nextUrl.pathname === "/login" && request.nextUrl.searchParams.get("preview") !== "1") {
      const { data: profile } = await supabase.from("profiles").select("is_marketing").eq("email", user.email).maybeSingle();
      return NextResponse.redirect(new URL(profile?.is_marketing ? "/board" : "/suggest", request.url));
    }

    if (!isEveryonePath) {
      const { data: profile } = await supabase.from("profiles").select("is_marketing").eq("email", user.email).maybeSingle();
      // A missing profile row (brand-new sign-in, trigger hasn't run yet) is
      // treated as not-marketing — fail closed rather than briefly exposing the board.
      // "/" falls in here too: a marketing match falls through to app/page.tsx's
      // own redirect("/board"), so it needs no special case of its own.
      if (!profile?.is_marketing) {
        return NextResponse.redirect(new URL("/suggest", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
