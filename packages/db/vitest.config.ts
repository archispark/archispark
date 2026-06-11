import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    // Only run tests in src/ — dist/ is compiled output that would otherwise be
    // picked up after a build, double-counting and diluting coverage.
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["**/package.json", "src/schema.ts", "src/schema.control.ts", "src/schema.tenant.ts"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
