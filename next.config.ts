import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // The app lives inside the react-calendar-timeline checkout, which has its own lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
