import { createMDX } from "fumadocs-mdx/next"
import { loadEnv } from "@workspace/env"

// Must run before any code reads process.env (e.g. the /api/contact route's
// SMTP_* vars) — same reasoning as apps/server/next.config.ts.
loadEnv()

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/user-guide",
        permanent: false,
      },
    ]
  },
}

export default withMDX(config)
