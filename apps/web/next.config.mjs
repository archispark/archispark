/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  async rewrites() {
    const api = process.env.ARCHIMATE_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api",
        destination: `${api}/`,
      },
      {
        source: "/api/:path*",
        destination: `${api}/:path*`,
      },
    ];
  },
}

export default nextConfig
