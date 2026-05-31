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
    // Only run tests in src/ — dist/ is compiled output and would otherwise
    // be picked up after `pnpm build`, inflating test counts and diluting coverage.
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
    env: {
      DB_PATH: ":memory:",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["**/package.json", "dist/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
