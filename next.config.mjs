/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [],
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
