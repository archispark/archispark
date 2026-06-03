import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@workspace/db": resolve(__dirname, "../../packages/db/src/index.ts"),
    },
    conditions: ["source", "import", "module", "default"],
  },
  test: {
    pool: "forks",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
