import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrationVersion, listMigrationFiles, runNeo4jMigrations, ensureNeo4jSchema } from "./migrate.js";

vi.mock("../connection.js", () => ({
  getDriver: vi.fn(),
}));

describe("migrationVersion", () => {
  it("extracts the numeric prefix before the first underscore", () => {
    expect(migrationVersion("0001_initial_constraints.cypher")).toBe("0001");
    expect(migrationVersion("0012_add_index.cypher")).toBe("0012");
  });

  it("throws on a filename without an underscore", () => {
    expect(() => migrationVersion("nounderscore.cypher")).not.toThrow();
    expect(migrationVersion("nounderscore.cypher")).toBe("nounderscore.cypher");
  });
});

describe("listMigrationFiles", () => {
  it("lists the shipped migrations sorted by filename", () => {
    const files = listMigrationFiles();
    expect(files).toEqual(["0001_initial_constraints.cypher"]);
  });
});

describe("runNeo4jMigrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips a migration already recorded as a :SchemaMigration node", async () => {
    const run = vi.fn().mockResolvedValue({ records: [{}] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("../connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    await runNeo4jMigrations();

    // Only the "already applied?" check ran — no CREATE CONSTRAINT / MERGE marker statements.
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0]).toContain("MATCH (sm:SchemaMigration");
    expect(close).toHaveBeenCalledOnce();
  });

  it("applies a pending migration's statements and records it", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("../connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    await runNeo4jMigrations();

    const queries = run.mock.calls.map((call) => call[0] as string);
    expect(queries[0]).toContain("MATCH (sm:SchemaMigration");
    expect(queries.some((q) => q.includes("CREATE CONSTRAINT element_id"))).toBe(true);
    expect(queries.at(-1)).toContain("MERGE (sm:SchemaMigration");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("ensureNeo4jSchema", () => {
  it("runs migrations on the first call and memoizes subsequent calls", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("../connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    await ensureNeo4jSchema();
    await ensureNeo4jSchema();

    // A second call is a no-op — the session is only opened/closed once.
    expect(close).toHaveBeenCalledOnce();
  });
});
