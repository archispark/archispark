import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [".next/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcovonly"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/*.config.*"],
    },
  },
})
