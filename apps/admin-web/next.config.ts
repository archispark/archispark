import type { NextConfig } from "next";
import os from "node:os";

// In dev mode, Next.js only initializes its client runtime (HMR + hydration)
// for requests whose origin is "allowed". Accessing the dev server from another
// machine on the LAN (e.g. http://192.168.1.x:8001) otherwise leaves the page
// un-hydrated — forms fall back to a native submit and never call the API.
// Auto-allow every non-internal IPv4 of this host, plus any ALLOWED_DEV_ORIGINS.
function lanDevOrigins(): string[] {
  const ips: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address);
    }
  }
  const extra = process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return [...ips, ...extra];
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: lanDevOrigins(),
  // TypeScript checking is done separately via pnpm --filter admin-web typecheck.
  typescript: { ignoreBuildErrors: true },

  async rewrites() {
    const apiUrl = process.env.ARCHIMATE_API_URL;

    // Production (Docker) : ARCHIMATE_API_URL="" → aucun rewrite,
    // le reverse proxy (Traefik) gère /api/* et /auth/* en amont de Next.js.
    if (apiUrl === "") return [];

    // Développement (pnpm dev) : proxy local vers l'API Express sur :3000
    const target = apiUrl || "http://localhost:3000";
    return [
      { source: "/api/:path*",  destination: `${target}/:path*`       },
      { source: "/auth/:path*", destination: `${target}/auth/:path*`  },
    ];
  },
};

export default nextConfig;
