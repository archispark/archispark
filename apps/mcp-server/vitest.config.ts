import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
      thresholds: { statements: 40, branches: 15, functions: 10, lines: 40 },
    },
  },
});
