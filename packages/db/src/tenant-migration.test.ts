import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrate.js";
import { controlDb, runWithTenantDb } from "./connection.js";
import * as schema from "./schema.js";
import { seedWorkspace, modelFromDb } from "./model-io.js";
import { migrateExistingTenant, cleanupMigratedSharedData } from "./tenant-migration.js";
import { decryptConnectionString } from "./tenant-crypto.js";
import type { ArchiModel } from "./model.js";

const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  await runMigrations();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV, TENANT_DB_ENCRYPTION_KEY: "test-tenant-migration-key" };
  vi.unstubAllGlobals();
});

function makeOrg(): string {
  return `org-migrate-test-${randomUUID()}`;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

function mockNeonFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/branches")) return jsonResponse({ branches: [{ id: "br-1", default: true }] });
    if (path.endsWith("/roles")) return jsonResponse({ role: { name: "tenant_role" } });
    if (path.endsWith("/databases")) return jsonResponse({ database: { name: "tenant_db" } });
    if (path.endsWith("/connection_uri")) return jsonResponse({ uri: "postgresql://tenant_role:pw@ep-fake.neon.tech/tenant_db" });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makePgliteTenantDb(): NodePgDatabase<typeof schema> {
  return drizzle(new PGlite(), { schema }) as unknown as NodePgDatabase<typeof schema>;
}

const elemA = { uuid: "id-elem-a", name: "App A", type: "ApplicationComponent", desc: null, props: { "id-pd-owner": "team-a" } };
const elemB = { uuid: "id-elem-b", name: "App B", type: "ApplicationComponent", desc: "second app", props: {} };

const sourceModel: ArchiModel = {
  uuid: "id-model-src",
  name: "Source",
  desc: "source workspace",
  version: "1.0.0",
  propertyDefinitions: [
    { uuid: "id-pd-owner", name: "Owner", type: "string" },
  ],
  elements: [elemA, elemB],
  relationships: [
    {
      uuid: "id-rel-1", name: "serves", type: "Serving",
      source: elemA, target: elemB,
      desc: null, props: { "id-pd-owner": "team-b" },
      access_type: null, is_directed: null, influence_strength: null,
    },
  ],
  views: [
    {
      uuid: "id-view-1", name: "Main View", desc: null, primary_viewpoint: "Application Cooperation",
      nodes: [
        {
          uuid: "id-node-a", name: null, ref: elemA,
          x: 10, y: 10, w: 100, h: 60,
          fill_color: null, line_color: null, font_name: null, font_size: null, font_color: null, line_width: null,
          archi_type: null, nodes: [],
        },
        {
          uuid: "id-node-b", name: null, ref: elemB,
          x: 200, y: 10, w: 100, h: 60,
          fill_color: null, line_color: null, font_name: null, font_size: null, font_color: null, line_width: null,
          archi_type: null, nodes: [],
        },
      ],
      conns: [
        {
          uuid: "id-conn-1", name: null, ref: "id-rel-1",
          source: "id-node-a", target: "id-node-b",
          line_color: null, font_name: null, font_size: null, font_color: null, line_width: null,
          bendpoints: [{ x: 150, y: 40 }],
        },
      ],
    },
  ],
};

describe("migrateExistingTenant", () => {
  it("is a no-op when Neon API credentials are not configured", async () => {
    delete process.env["NEON_API_KEY"];
    delete process.env["NEON_PROJECT_ID"];
    const orgId = await makeOrg();
    await seedWorkspace("Source", sourceModel, orgId);

    const result = await migrateExistingTenant(orgId);

    expect(result).toEqual({ migrated: false, workspacesMigrated: 0 });
    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row).toBeUndefined();
  });

  it("copies workspaces, content, workspace_teams and user_active_workspace to the new tenant database", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    mockNeonFetch();

    const orgId = await makeOrg();
    const srcWsId = await seedWorkspace("Source", sourceModel, orgId);
    await controlDb.insert(schema.workspaceTeams).values({ workspaceId: srcWsId, teamId: "team-1" });
    await controlDb.insert(schema.userActiveWorkspace).values({ userId: "user-1", organizationId: orgId, workspaceId: srcWsId });

    let tenantDb: NodePgDatabase<typeof schema> | undefined;
    const result = await migrateExistingTenant(orgId, {
      tenantDbFactory: () => {
        tenantDb = makePgliteTenantDb();
        return tenantDb;
      },
    });

    expect(result).toEqual({ migrated: true, workspacesMigrated: 1 });

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("active");
    expect(decryptConnectionString(row!.connectionStringEncrypted)).toBe("postgresql://tenant_role:pw@ep-fake.neon.tech/tenant_db");

    const tenantWorkspaces = await tenantDb!.select().from(schema.workspaces);
    expect(tenantWorkspaces).toHaveLength(1);
    const newWs = tenantWorkspaces[0]!;
    expect(newWs.name).toBe("Source");
    expect(newWs.uuid).toBe(sourceModel.uuid);
    expect(newWs.description).toBe(sourceModel.desc);
    expect(newWs.organizationId).toBe(orgId);

    const migratedModel = await runWithTenantDb(tenantDb!, () => modelFromDb(newWs.id));
    expect(migratedModel.elements).toEqual(sourceModel.elements);
    expect(migratedModel.relationships).toEqual(sourceModel.relationships);
    expect(migratedModel.propertyDefinitions).toEqual(sourceModel.propertyDefinitions);
    expect(migratedModel.views).toEqual(sourceModel.views);

    const tenantTeams = await tenantDb!.select().from(schema.workspaceTeams);
    expect(tenantTeams).toEqual([{ workspaceId: newWs.id, teamId: "team-1" }]);

    const tenantActive = await tenantDb!.select().from(schema.userActiveWorkspace);
    expect(tenantActive).toEqual([{ userId: "user-1", organizationId: orgId, workspaceId: newWs.id }]);
  });
});

describe("cleanupMigratedSharedData", () => {
  it("throws if the tenant database is not active", async () => {
    const orgId = await makeOrg();
    await expect(cleanupMigratedSharedData(orgId)).rejects.toThrow(/not active/);
  });

  it("deletes the organization's workspaces (and related rows) from the shared database once active", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    mockNeonFetch();

    const orgId = await makeOrg();
    const srcWsId = await seedWorkspace("Source", sourceModel, orgId);
    await controlDb.insert(schema.workspaceTeams).values({ workspaceId: srcWsId, teamId: "team-1" });
    await controlDb.insert(schema.userActiveWorkspace).values({ userId: "user-1", organizationId: orgId, workspaceId: srcWsId });

    await migrateExistingTenant(orgId, { tenantDbFactory: makePgliteTenantDb });

    const deletedCount = await cleanupMigratedSharedData(orgId);
    expect(deletedCount).toBe(1);

    const remainingWorkspaces = await controlDb.select().from(schema.workspaces).where(eq(schema.workspaces.id, srcWsId));
    expect(remainingWorkspaces).toEqual([]);
    const remainingTeams = await controlDb.select().from(schema.workspaceTeams).where(eq(schema.workspaceTeams.workspaceId, srcWsId));
    expect(remainingTeams).toEqual([]);
    const remainingActive = await controlDb.select().from(schema.userActiveWorkspace)
      .where(eq(schema.userActiveWorkspace.organizationId, orgId));
    expect(remainingActive).toEqual([]);
    const remainingElements = await controlDb.select().from(schema.elements).where(eq(schema.elements.workspaceId, srcWsId));
    expect(remainingElements).toEqual([]);
  });
});
