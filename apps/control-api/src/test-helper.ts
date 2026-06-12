import request from "supertest";
import { db, users as usersTable, members as membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { app } from "./app.js";
import { initUsers, getMembershipContext } from "./auth.js";
import type { WorkspaceContext } from "./auth.js";

let initPromise: Promise<void> | null = null;
let adminCookie: string | null = null;
let userCookie: string | null = null;

async function ensureInit() {
  if (!initPromise) initPromise = initUsers();
  return initPromise;
}

export async function getAdminCookie(): Promise<string> {
  if (adminCookie) return adminCookie;
  await ensureInit();
  const res = await request(app)
    .post("/auth/sign-in/username")
    .send({ username: "admin", password: "admin" });
  const setCookie = res.headers["set-cookie"];
  if (!setCookie || res.status !== 200) {
    throw new Error(`Admin sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  adminCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
  return adminCookie;
}

export async function getUserCookie(): Promise<string> {
  if (userCookie) return userCookie;
  await ensureInit();
  const res = await request(app)
    .post("/auth/sign-in/username")
    .send({ username: "user", password: "user" });
  const setCookie = res.headers["set-cookie"];
  if (!setCookie || res.status !== 200) {
    throw new Error(`User sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  userCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
  return userCookie;
}

/** The admin user's id and organization membership context (org owner). */
export async function getAdminWorkspaceContext(): Promise<{ userId: string; ctx: WorkspaceContext }> {
  await ensureInit();
  const [admin] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, "admin"));
  if (!admin) throw new Error("Admin user not found.");
  const [member] = await db.select({ organizationId: membersTable.organizationId }).from(membersTable)
    .where(eq(membersTable.userId, admin.id)).limit(1);
  if (!member) throw new Error("Admin has no organization membership.");
  const ctx = await getMembershipContext(admin.id, member.organizationId);
  if (!ctx) throw new Error("Admin membership context not found.");
  return { userId: admin.id, ctx };
}
