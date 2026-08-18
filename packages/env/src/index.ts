import { existsSync, readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

// This module always lives at packages/env/src (or packages/env/dist once
// built) — both are exactly three directories below the repo root.
export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../..")
}

// Parses a dotenv-style file (KEY=VALUE, "#" comments, quoted values,
// ${VAR} interpolation against vars already in process.env or loaded
// earlier in the same file — same convention as docker-compose) and merges
// it into process.env. A variable already set in process.env always wins:
// dotenv files never override a real environment variable. No-op if the
// file doesn't exist.
export function applyEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const rawVal = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "")
    const val = rawVal.replace(
      /\$\{(\w+)\}/g,
      (_match: string, name: string) => process.env[name] ?? ""
    )
    if (key && !(key in process.env)) process.env[key] = val
  }
}

// Loads `.env` from the repo root, if present. Call once at process
// startup, before any code that reads process.env at module-init time.
export function loadEnv(): void {
  applyEnvFile(join(repoRoot(), ".env"))
}

export {
  blankToUndefined,
  optionalEnvString,
  parseEnv,
  smtpEnvSchema,
} from "./schema.js"
export type { SmtpEnv } from "./schema.js"
