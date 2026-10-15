import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.lolesports.com" },
      { protocol: "http", hostname: "static.lolesports.com" },
      { protocol: "https", hostname: "am-a.akamaihd.net" },
    ],
  },
};

export default nextConfig;
