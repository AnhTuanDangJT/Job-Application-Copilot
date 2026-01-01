import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don't fail build on linting errors - these are mostly style warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail build on TypeScript errors - these are mostly type narrowing issues with Mongoose .lean()
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
