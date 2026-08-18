import { configDefaults, defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

// Two projects: "web" runs the existing React component/page tests under
// jsdom; "server" runs the migrated apps/api + apps/mcp-server business
// logic and route-handler tests under Node (PGlite via test-setup.ts, same
// as apps/api before the merge).
// pages/api/ is deliberately excluded: Next.js's Pages Router treats every
// file under pages/api/ as a live route, so a colocated `*.test.ts` there
// would itself become a served endpoint at build time (it happened once —
// see lib/mcp/mcp-route.test.ts, which tests pages/api/mcp.ts from outside
// pages/). Keep any future Pages Router route tests out of pages/ entirely.
const serverTestDirs = [
  "lib/archimate/**",
  "lib/mcp/**",
  "lib/http/**",
  "lib/dashboards/**",
  "lib/plugins/**",
  "app/api/plugins/**",
  "app/api/platform/plugins/**",
]

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": resolve(__dirname, "."),
            "@workspace/ui": resolve(__dirname, "../../packages/ui/src"),
            "@workspace/auth": resolve(
              __dirname,
              "../../packages/auth/src/index.ts"
            ),
          },
        },
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          globals: true,
          // Some component tests chain several renders/waitFor cycles; under
          // turbo's workspace-wide parallel test run the 5s default can be
          // exceeded on a loaded machine.
          testTimeout: 15000,
          // Playwright owns e2e/*.spec.ts (see playwright.config.ts) — its
          // default test glob would otherwise also match here, since this
          // project has no explicit `include`.
          exclude: [
            ...configDefaults.exclude,
            ".next/**",
            "e2e/**",
            ...serverTestDirs,
          ],
        },
      },
      {
        resolve: {
          alias: {
            "@": resolve(__dirname, "."),
            "@workspace/db": resolve(
              __dirname,
              "../../packages/db/src/index.ts"
            ),
            "@workspace/db-neo4j": resolve(
              __dirname,
              "../../packages/db-neo4j/src/index.ts"
            ),
            "@workspace/auth": resolve(
              __dirname,
              "../../packages/auth/src/index.ts"
            ),
          },
        },
        test: {
          name: "server",
          environment: "node",
          pool: "forks",
          // PGlite (WASM Postgres) round-trips are slower than a mocked DB —
          // see apps/api's former vitest.config.ts / .
          testTimeout: 90000,
          include: serverTestDirs.map((dir) => `${dir}/*.test.ts`),
          setupFiles: ["./lib/archimate/test-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["lcovonly", "json-summary", "json"],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.config.*",
        "proxy.ts",
      ],
    },
  },
})
