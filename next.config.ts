import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://127.0.0.1:4100"}/api/:path*`,
      },
    ];
  },
};
export default config;
