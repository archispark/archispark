import request from "supertest";
import { app } from "./app.js";
import { initUsers } from "./auth.js";

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
