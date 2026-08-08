import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArchiModel } from "@workspace/db";
import { importModelToNeo4j } from "./import-model.js";

vi.mock("./connection.js", () => ({ getDriver: vi.fn() }));
vi.mock("./schema/migrate.js", () => ({ ensureNeo4jSchema: vi.fn().mockResolvedValue(undefined) }));

function emptyModel(): ArchiModel {
  return {
    uuid: "id-model-1",
    name: "Test model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  };
}

function testOrg() {
  return { id: 1, slug: "acme", name: "Acme" };
}

describe("importModelToNeo4j", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures the schema, wipes the workspace subgraph first, and closes the session", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("./connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);
    const { ensureNeo4jSchema } = await import("./schema/migrate.js");

    const result = await importModelToNeo4j(emptyModel(), testOrg());

    expect(ensureNeo4jSchema).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]![0]).toContain("DETACH DELETE p, n, m");
    expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual({
      modelId: "id-model-1",
      elements: 0,
      relationships: 0,
      views: 0,
      properties: 0,
      importedAt: expect.any(String),
    });
  });

  it("writes one UNWIND query per relationship type and counts every entity", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("./connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    const model: ArchiModel = {
      ...emptyModel(),
      elements: [{ uuid: "el-1", name: "A", type: "ApplicationComponent", desc: null, props: { "pd-1": "x" } }],
      propertyDefinitions: [{ uuid: "pd-1", name: "Owner", type: "string" }],
      relationships: [
        {
          uuid: "rel-1",
          name: null,
          type: "Serving",
          source: "el-1",
          target: "el-1",
          desc: null,
          props: { "pd-1": "y" },
          access_type: null,
          is_directed: null,
          influence_strength: null,
        },
      ],
      views: [{ uuid: "view-1", name: "Overview", desc: null, primary_viewpoint: null, nodes: [], conns: [] }],
    };

    const result = await importModelToNeo4j(model, testOrg());

    const relationshipQueries = run.mock.calls.filter((call) => (call[0] as string).includes("MERGE (s)-[r:"));
    expect(relationshipQueries).toHaveLength(1);
    expect(relationshipQueries[0]![0]).toContain("MERGE (s)-[r:SERVING");
    expect(result).toMatchObject({ elements: 1, relationships: 1, views: 1, properties: 2 });
  });

  it("tags the organization node, links it to the model, and stamps organizationId on every write", async () => {
    const run = vi.fn().mockResolvedValue({ records: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("./connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    const model: ArchiModel = {
      ...emptyModel(),
      elements: [{ uuid: "el-1", name: "A", type: "ApplicationComponent", desc: null, props: { "pd-1": "x" } }],
      propertyDefinitions: [{ uuid: "pd-1", name: "Owner", type: "string" }],
      relationships: [
        {
          uuid: "rel-1",
          name: null,
          type: "Serving",
          source: "el-1",
          target: "el-1",
          desc: null,
          props: {},
          access_type: null,
          is_directed: null,
          influence_strength: null,
        },
      ],
      views: [{ uuid: "view-1", name: "Overview", desc: null, primary_viewpoint: null, nodes: [], conns: [] }],
    };

    await importModelToNeo4j(model, testOrg());

    const orgCall = run.mock.calls.find((call) => (call[0] as string).includes("MERGE (o:Organization"));
    expect(orgCall![1]).toEqual({ id: 1, slug: "acme", name: "Acme" });

    const modelCall = run.mock.calls.find((call) => (call[0] as string).includes("MERGE (o)-[:HAS_MODEL]->(m)"));
    expect(modelCall![1]).toMatchObject({ organizationId: 1, id: "id-model-1" });

    const elementsCall = run.mock.calls.find((call) => (call[0] as string).includes("MERGE (e:Element"));
    expect((elementsCall![1] as { elements: { organizationId: number }[] }).elements[0]!.organizationId).toBe(1);

    const relCall = run.mock.calls.find((call) => (call[0] as string).includes("MERGE (s)-[r:SERVING"));
    expect((relCall![1] as { relationships: { organizationId: number }[] }).relationships[0]!.organizationId).toBe(1);

    const viewsCall = run.mock.calls.find((call) => (call[0] as string).includes("MERGE (view:View"));
    expect((viewsCall![1] as { views: { organizationId: number }[] }).views[0]!.organizationId).toBe(1);
  });

  it("closes the session even when a write fails", async () => {
    const run = vi.fn().mockRejectedValue(new Error("boom"));
    const close = vi.fn().mockResolvedValue(undefined);
    const { getDriver } = await import("./connection.js");
    vi.mocked(getDriver).mockReturnValue({ session: () => ({ run, close }) } as never);

    await expect(importModelToNeo4j(emptyModel(), testOrg())).rejects.toThrow("boom");
    expect(close).toHaveBeenCalledOnce();
  });
});
