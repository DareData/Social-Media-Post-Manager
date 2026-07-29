import type { MetadataRoute } from "next";

// Internal tool — nothing here should ever show up in search results.
// Belt-and-braces alongside the noindex meta tag in app/layout.tsx: this
// asks crawlers not to visit at all, that stops indexing even if one does.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
