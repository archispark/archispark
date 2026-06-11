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
    testTimeout: 15000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcovonly"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
    },
  },
});
