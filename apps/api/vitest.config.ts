import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@workspace/db": resolve(__dirname, "../../packages/db/src/index.ts"),
    },
  },
  test: {
    pool: "forks",
    // PGlite (WASM Postgres) async round-trips are slower than the former
    // synchronous SQLite, especially for tests chaining several mutations that
    // each trigger a full model auto-save. Allow more headroom than the 5s default.
    testTimeout: 20000,
    // Only run tests in src/ — dist/ is compiled output and would otherwise
    // be picked up after `pnpm build`, inflating test counts and diluting coverage.
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcovonly"],
      exclude: ["**/package.json", "dist/**"],
    },
  },
});
