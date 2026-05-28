import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    singleFork: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
