import { Redis } from "ioredis";

let _redis: Redis | null = null;

export function initRedis(): void {
  const url = process.env["REDIS_URL"];
  if (!url) return;

  _redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  _redis.on("connect", () => console.log("[redis] connected"));
  _redis.on("error", (err: Error) => console.error("[redis] error:", err.message));
}

export function getRedis(): Redis | null {
  return _redis;
}
