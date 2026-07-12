/**
 * Generates openapi.json from the TypeScript spec and writes it to:
 *   - apps/api/openapi.json                (source of truth)
 *   - archispark-docs/public/openapi.json  (if the repo exists alongside archispark)
 *
 * Usage: pnpm --filter api openapi
 */
import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiSpec } from "../src/openapi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const json = JSON.stringify(openApiSpec, null, 2) + "\n";

// Primary output: apps/api/openapi.json
const apiOut = resolve(__dirname, "../openapi.json");
writeFileSync(apiOut, json, "utf-8");
console.log(`✓ ${apiOut}`);

// Secondary output: archispark-docs/public/openapi.json (optional, if repo is present)
const docsOut = resolve(__dirname, "../../../../archispark-docs/public/openapi.json");
if (existsSync(resolve(docsOut, "../"))) {
  writeFileSync(docsOut, json, "utf-8");
  console.log(`✓ ${docsOut}`);
} else {
  console.log(`  archispark-docs not found at ${docsOut} — skipping.`);
}
