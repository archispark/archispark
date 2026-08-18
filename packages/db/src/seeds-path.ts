import { fileURLToPath } from "url"

// Shared by every module that reads a non-JS file from packages/db/seeds/
// at runtime (local-demo-users.ts, seed-demo-data.ts,
// seed-dashboards-data.ts). Mirrors migrate.ts's dist/source resolution:
// when compiled to dist/, seed files are copied alongside as dist/seeds/
// (see package.json's build script); when run from source (tests via tsx,
// CLI scripts), fall back to the original ../seeds.
export function seedsPath(fileName: string): string {
  const dir = new URL(import.meta.url).pathname.includes("/dist/")
    ? "./seeds"
    : "../seeds"
  return fileURLToPath(new URL(`${dir}/${fileName}`, import.meta.url))
}
