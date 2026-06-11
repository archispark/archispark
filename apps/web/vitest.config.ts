import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["lcovonly"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/coverage/**", "**/*.config.*", "proxy.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@workspace/ui": resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
