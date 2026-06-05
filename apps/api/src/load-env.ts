import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load apps/api/.env as a fallback for local dev (no Docker).
// process.loadEnvFile() does NOT override variables already present in the
// environment, so Docker / shell env vars always take precedence.
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
