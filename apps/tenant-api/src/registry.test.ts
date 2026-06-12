/**
 * Tests for src/registry.ts — workspace routes.
 */

import { describe, it, expect, beforeAll } from "vitest";
import _request from "supertest";
import { app } from "../src/app.js";
import { getAdminToken } from "../src/test-helper.js";

let adminToken: string;

beforeAll(async () => {
  adminToken = getAdminToken();
  // Ensure at least one workspace exists so all tests have a baseline.
  const list = await _request(app)
    .get("/workspaces")
    .set("Authorization", `Bearer ${adminToken}`);
  if ((list.body as unknown[]).length === 0) {
    await _request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Default" });
  }
});

function request(appArg: Parameters<typeof _request>[0]) {
  return _request.agent(appArg).set("Authorization", `Bearer ${adminToken}`);
}

// ===========================================================================
// Workspace routes
// ===========================================================================

describe("GET /workspaces", () => {
  it("returns list with at least one workspace", async () => {
    const res = await request(app).get("/workspaces");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("active");
  });

  it("marks one workspace as active", async () => {
    const res = await request(app).get("/workspaces");
    const active = res.body.filter((w: { active: boolean }) => w.active);
    expect(active.length).toBe(1);
  });
});

describe("POST /workspaces", () => {
  it("returns 422 when name missing", async () => {
    const res = await request(app).post("/workspaces").send({});
    expect(res.status).toBe(422);
  });

  it("creates a workspace with empty model", async () => {
    const name = `Test Workspace ${Date.now()}`;
    const res = await request(app).post("/workspaces").send({ name });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(res.body).toHaveProperty("id");
  });

  it("returns 422 for duplicate workspace name", async () => {
    await request(app).post("/workspaces").send({ name: "Duplicate WS" });
    const res = await request(app).post("/workspaces").send({ name: "Duplicate WS" });
    expect(res.status).toBe(422);
  });

  it("returns 422 for missing xml file path", async () => {
    const res = await request(app).post("/workspaces").send({ name: "XML WS", path: "nonexistent.xml" });
    expect(res.status).toBe(422);
  });
});

describe("PUT /workspaces/:id", () => {
  it("returns 422 when name missing", async () => {
    const wsRes = await request(app).get("/workspaces");
    const id = wsRes.body[0].id;
    const res = await request(app).put(`/workspaces/${id}`).send({});
    expect(res.status).toBe(422);
  });

  it("renames a workspace", async () => {
    const ts = Date.now();
    const createRes = await request(app).post("/workspaces").send({ name: `ToRename WS ${ts}` });
    const id = createRes.body.id;
    const res = await request(app).put(`/workspaces/${id}`).send({ name: `Renamed WS ${ts}` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Renamed WS ${ts}`);
  });

  it("returns 404 for unknown workspace id", async () => {
    const res = await request(app).put("/workspaces/99999").send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

describe("POST /workspaces/:id/activate", () => {
  it("activates a workspace and marks it active", async () => {
    const createRes = await request(app).post("/workspaces").send({ name: `WS To Activate ${Date.now()}` });
    const id = createRes.body.id;
    const res = await request(app).post(`/workspaces/${id}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    const wsRes = await request(app).get("/workspaces");
    const active = wsRes.body.find((w: { id: string; active: boolean }) => w.id === id);
    expect(active?.active).toBe(true);
  });

  it("returns 404 for unknown workspace id", async () => {
    const res = await request(app).post("/workspaces/99999/activate");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /workspaces/:id", () => {
  it("deletes the active workspace and activates another", async () => {
    await request(app).post("/workspaces").send({ name: "Extra WS for active-delete" });
    const before = (await request(app).get("/workspaces")).body as { id: string; active: boolean }[];
    const active = before.find((w) => w.active)!;
    const res = await request(app).delete(`/workspaces/${active.id}`);
    expect(res.status).toBe(204);
    const after = (await request(app).get("/workspaces")).body as { id: string; active: boolean }[];
    expect(after.find((w) => w.id === active.id)).toBeUndefined();
    expect(after.filter((w) => w.active)).toHaveLength(1);
  });

  it("deletes an inactive workspace", async () => {
    const createRes = await request(app).post("/workspaces").send({ name: "WS To Delete" });
    const id = createRes.body.id;
    const res = await request(app).delete(`/workspaces/${id}`);
    expect(res.status).toBe(204);
  });

  it("returns 422 for unknown workspace id", async () => {
    await request(app).post("/workspaces").send({ name: "Extra WS for unknown delete" });
    const res = await request(app).delete("/workspaces/99999");
    expect(res.status).toBe(422);
  });

  // Keep this last: it empties the workspace table for the rest of the file.
  it("allows deleting the last workspace, leaving zero", async () => {
    const list = (await request(app).get("/workspaces")).body as { id: string }[];
    for (const w of list) {
      expect((await request(app).delete(`/workspaces/${w.id}`)).status).toBe(204);
    }
    const after = (await request(app).get("/workspaces")).body as unknown[];
    expect(after).toHaveLength(0);
  });

  it("re-activates the first workspace created after the table was emptied", async () => {
    const res = await request(app).post("/workspaces").send({ name: "First after empty" });
    expect(res.status).toBe(201);
    expect(res.body.active).toBe(true);
  });
});
