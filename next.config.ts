import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Post media (images/videos' thumbnails) is uploaded to Supabase Storage
    // and served from the project's own public object URL — next/image
    // needs the host allow-listed to optimize/resize it.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
