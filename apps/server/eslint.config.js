import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    files: ["*.config.mjs", "*.config.js", "scripts/docker-migrate.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
  {
    // Machine-generated plugin data (scripts/generate-plugin-registry.ts),
    // never hand-edited — max-lines has nothing actionable to say about it.
    ignores: ["lib/plugins/registry.generated.ts"],
  },
]
