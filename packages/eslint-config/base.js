import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import onlyWarn from "eslint-plugin-only-warn"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    // Contrôle de la taille des fichiers pour préserver les tokens IA et optimiser les tests
    rules: {
      "max-lines": [
        "error",
        {
          max: 250,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    ignores: ["dist/**", ".next/**", "**/.turbo/**", "**/coverage/**"],
  },
]
