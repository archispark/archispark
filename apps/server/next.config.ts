import type { NextConfig } from "next"
import os from "node:os"
import { loadEnv } from "@workspace/env"

// Must run before anything below reads process.env (e.g. ALLOWED_DEV_ORIGINS
// just below): next.config.ts is the first user code Next.js executes for
// `next dev` / `next build` / `next start`, earlier than instrumentation.ts.
loadEnv()

// In dev mode, Next.js only initializes its client runtime (HMR + hydration)
// for requests whose origin is "allowed". Accessing the dev server from another
// machine on the LAN (e.g. http://192.168.1.x:8000) otherwise leaves the page
// un-hydrated — forms fall back to a native submit and never call the API.
// Auto-allow every non-internal IPv4 of this host, plus any ALLOWED_DEV_ORIGINS.
function lanDevOrigins(): string[] {
  const ips: string[] = []
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address)
    }
  }
  const extra =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  return [...ips, ...extra]
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  // Without this, Next's own trailing-slash redirect (/mcp/ → /mcp, 308)
  // fires *before* rewrites are evaluated, so the /mcp/:path* rewrite below
  // never even sees the request the pre-fusion external contract actually
  // sends (POST https://.../mcp/, trailing slash). A redirect hop would also
  // break MCP clients that send a non-replayable streamed request body.
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: lanDevOrigins(),
  // TypeScript checking is done separately via pnpm --filter server typecheck.
  typescript: { ignoreBuildErrors: true },

  async rewrites() {
    // Preserves the pre-fusion external MCP contract (/mcp/) — existing
    // client configs (Claude Desktop, mcp-inspector, ...) keep working
    // unchanged even though the transport now lives at pages/api/mcp.ts.
    return [{ source: "/mcp/:path*", destination: "/api/mcp" }]
  },
}

export default nextConfig
