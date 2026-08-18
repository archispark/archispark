import { createMDX } from "fumadocs-mdx/next"
import { z } from "zod"
import {
  blankToUndefined,
  loadEnv,
  parseEnv,
  smtpEnvSchema,
} from "@workspace/env"

// Must run before any code reads process.env (e.g. the /api/contact route's
// SMTP_* vars) — same reasoning as apps/server/next.config.ts.
//
// Unlike apps/server, this validation isn't factored into a local ./env.ts
// module: apps/docs runs its config through webpack, not Turbopack, and
// webpack's next.config loader doesn't bundle further local TS imports the
// way Next's next.config.ts loader does — a relative "./env" import here
// fails to resolve at runtime even though it type-checks fine. Kept inline
// as a startup sanity check only: lib/contact.ts still reads process.env
// directly rather than a shared parsed object, since its test suite mutates
// SMTP_* and CONTACT_TO_EMAIL per test case (simulating missing config),
// which a value frozen at import time couldn't reflect.
loadEnv()
parseEnv(
  smtpEnvSchema.extend({
    CONTACT_TO_EMAIL: z.preprocess(
      blankToUndefined,
      z.string().email().optional()
    ),
  })
)

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
