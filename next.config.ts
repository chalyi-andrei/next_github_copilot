import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Owner avatars on the Statistics page. Keep the object form without
    // `search`: avatar URLs carry a query string ("?v=4") that must be allowed.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
