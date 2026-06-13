/**
 * Operator script: resets Redis-backed API rate-limit counters
 * (`rl:auth:*`, `rl:api:*`, `rl:import:*` — see `src/app.ts`).
 *
 * Works against any `REDIS_URL`: local docker-compose Redis
 * (`redis://localhost:6379`) or a remote instance used by Vercel deployments
 * (`rediss://...`, TLS auto-detected by ioredis from the scheme).
 *
 * Usage:
 *   tsx scripts/reset-rate-limit.ts                # list current counters
 *   tsx scripts/reset-rate-limit.ts <ip>           # reset counters for one IP
 *   tsx scripts/reset-rate-limit.ts --all --yes    # reset every counter (all clients)
 */

import { Redis } from "ioredis";

const PREFIXES = ["rl:auth:", "rl:api:", "rl:import:"];

async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  const stream = redis.scanStream({ match: pattern, count: 100 });
  for await (const batch of stream) keys.push(...(batch as string[]));
  return keys;
}

async function main(): Promise<void> {
  const url = process.env["REDIS_URL"];
  if (!url) {
    console.error("REDIS_URL non défini.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const yes = args.includes("--yes");
  const ip = args.find((a) => !a.startsWith("--"));

  const redis = new Redis(url);

  if (!all && !ip) {
    const keys = await scanKeys(redis, "rl:*");
    if (keys.length === 0) {
      console.log("Aucun compteur de rate-limit actif.");
    } else {
      const values = await Promise.all(keys.map((k) => redis.get(k)));
      for (const [i, key] of keys.entries()) console.log(`${key} = ${values[i]}`);
      console.log("\nUsage: tsx scripts/reset-rate-limit.ts <ip>  ou  --all --yes");
    }
    await redis.quit();
    return;
  }

  if (all && !yes) {
    console.error("--all réinitialise les compteurs de TOUS les clients : passez --yes pour confirmer.");
    await redis.quit();
    process.exit(1);
  }

  const keys = all ? await scanKeys(redis, "rl:*") : PREFIXES.map((p) => `${p}${ip}`);
  let deleted = 0;
  for (const key of keys) deleted += await redis.del(key);

  console.log(`${deleted} compteur(s) réinitialisé(s).`);
  await redis.quit();
}

await main();
process.exit(process.exitCode ?? 0);
