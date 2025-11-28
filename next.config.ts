import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // eslint configuration removed - Next.js 16 no longer supports eslint in next.config.ts
  // Use .eslintrc.json or eslint.config.js instead
  typescript: {
    ignoreBuildErrors: true
  },
  // Enable development indicators (error overlay button, build activity)
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-left',
  },
};

export default nextConfig;
