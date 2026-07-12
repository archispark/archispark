import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Some component tests chain several renders/waitFor cycles; under
    // turbo's workspace-wide parallel test run the 5s default can be
    // exceeded on a loaded machine. Allow more headroom (see apps/api).
    testTimeout: 15000,
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
      "@workspace/auth": resolve(
        __dirname,
        "../../packages/auth/src/index.ts"
      ),
    },
  },
});
