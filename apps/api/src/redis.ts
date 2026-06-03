import { Redis } from "ioredis";

let _redis: Redis | null = null;

export function initRedis(): void {
  const url = process.env["REDIS_URL"];
  if (!url) throw new Error("[redis] REDIS_URL non défini.");

  _redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  _redis.on("connect", () => console.log("[redis] connected"));
  _redis.on("error", (err: Error) => console.error("[redis] error:", err.message));
}

export function getRedis(): Redis {
  if (!_redis) throw new Error("[redis] Non initialisé — appelez initRedis() au démarrage.");
  return _redis;
}
