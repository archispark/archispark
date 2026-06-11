import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    files: ["*.config.mjs", "*.config.js"],
    languageOptions: { globals: { process: "readonly" } },
  },
]
