import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@acmp/shared", "@acmp/validators"],
  
  // Enable standalone output for Docker deployment
  output: "standalone",
  
  // Expose app version from package.json
  env: {
    APP_VERSION: process.env.npm_package_version || "0.1.4",
  },
  
  async redirects() {
    return [
      { source: "/app/:path*", destination: "/participant/:path*", permanent: true },
      { source: "/org/:path*", destination: "/partners/:path*", permanent: true },
      { source: "/portal/:path*", destination: "/staff/:path*", permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        // Local MinIO for development
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;

