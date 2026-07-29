import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

// Stand-in for the brand's Swiza (a light, rounded geometric grotesque) —
// no Swiza font file was available, so this is the closest widely-available
// match until the real one is supplied. Same family for body and headings,
// matching Swiza's own usage (Light 300 for display, regular/medium for body).
const brandSans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Media Post Manager — GenOS",
  description: "Internal tool for tracking social media posts across LinkedIn, Instagram, and X.",
  // Internal tool, plus a couple of deliberately public no-login pages
  // (/p/[id] share links, /login, /suggest) — none of it belongs in search
  // results. robots.txt only asks crawlers nicely; this tag is the stronger
  // signal that keeps a page out of the index even if something does crawl it.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${brandSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint — without this, the
            page would flash light and then snap to dark a beat later, since
            the store's own theme effect only runs after React mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
