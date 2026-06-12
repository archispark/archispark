import { Redis } from "ioredis";

let _redis: Redis | null = null;

export function initRedis(): Promise<void> {
  const url = process.env["REDIS_URL"];
  if (!url) throw new Error("[redis] REDIS_URL non défini.");

  return new Promise((resolve, reject) => {
    _redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
    _redis.once("ready", () => { console.log("[redis] connected"); resolve(); });
    _redis.once("error", (err: Error) => { console.error("[redis] error:", err.message); reject(err); });
    _redis.on("error", (err: Error) => console.error("[redis] error:", err.message));
  });
}

export function getRedis(): Redis {
  if (!_redis) throw new Error("[redis] Non initialisé — appelez initRedis() au démarrage.");
  return _redis;
}
