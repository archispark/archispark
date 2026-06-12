import { vi } from "vitest";
import { runMigrations } from "@workspace/db";

// Redis n'est pas disponible dans l'environnement de test. Ce mock est appliqué
// globalement (avant le chargement de tout module) afin que app.ts reçoive un
// faux client Redis au lieu de throw.
// redis.test.ts utilise vi.unmock("./redis.js") pour tester l'implémentation réelle.
vi.mock("./redis.js", () => {
  const store = new Map<string, string>();
  const mockRedis = {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    setex: vi.fn().mockImplementation((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    del: vi.fn().mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    // rate-limit-redis: SCRIPT LOAD → SHA, EVALSHA → [totalHits≥1, resetMs]
    call: vi.fn().mockImplementation((cmd: string) =>
      Promise.resolve(cmd === "EVALSHA" ? [1, Date.now() + 60000] : "mockedsha")
    ),
    ping: vi.fn().mockResolvedValue("PONG"),
  };
  return {
    initRedis: vi.fn(),
    getRedis: vi.fn().mockReturnValue(mockRedis),
  };
});

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every tenant table (workspaces, elements,
// relationships, views, ...) exists. runMigrations() is idempotent.
await runMigrations();
