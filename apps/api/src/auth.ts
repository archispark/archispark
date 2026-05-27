import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: string;
}

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const USERS_FILE = join(process.cwd(), "data/users.json");
export const JWT_SECRET = process.env.JWT_SECRET ?? "archispark-dev-secret-change-in-prod";
const JWT_EXPIRES = "24h";

function loadUsers(): User[] {
  if (!existsSync(USERS_FILE)) {
    mkdirSync(dirname(USERS_FILE), { recursive: true });
    const now = new Date().toISOString();
    const defaults: User[] = [
      {
        id: crypto.randomUUID(),
        username: "admin",
        password_hash: bcrypt.hashSync("admin", 10),
        role: "admin",
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        username: "user",
        password_hash: bcrypt.hashSync("user", 10),
        role: "user",
        created_at: now,
      },
    ];
    writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2), "utf-8");
    console.log("[auth] Default users created — admin/admin (admin) · user/user (read-only)");
    return defaults;
  }
  return JSON.parse(readFileSync(USERS_FILE, "utf-8")) as User[];
}

export function saveUsers(users: User[]): void {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export const users: User[] = loadUsers();

// ---------------------------------------------------------------------------
// Business logic
// ---------------------------------------------------------------------------

export function userOut(u: User): UserOut {
  return { id: u.id, username: u.username, role: u.role, created_at: u.created_at };
}

export function loginUser(username: string, password: string): string | null {
  const user = users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function createUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user"
): UserOut {
  if (!username?.trim()) throw new Error("Le nom d'utilisateur est requis.");
  if (!password || password.length < 4) throw new Error("Le mot de passe doit contenir au moins 4 caractères.");
  if (users.find((u) => u.username === username)) throw new Error("Ce nom d'utilisateur est déjà pris.");
  const user: User = {
    id: crypto.randomUUID(),
    username: username.trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return userOut(user);
}

export function updateUser(
  id: string,
  updates: { password?: string; role?: "admin" | "user" }
): UserOut {
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error("Utilisateur introuvable.");
  if (updates.password !== undefined) {
    if (updates.password.length < 4) throw new Error("Le mot de passe doit contenir au moins 4 caractères.");
    user.password_hash = bcrypt.hashSync(updates.password, 10);
  }
  if (updates.role !== undefined) user.role = updates.role;
  saveUsers(users);
  return userOut(user);
}

export function deleteUser(id: string): void {
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("Utilisateur introuvable.");
  if (users.length === 1) throw new Error("Impossible de supprimer le dernier utilisateur.");
  users.splice(idx, 1);
  saveUsers(users);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Non authentifié." });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ detail: "Token invalide ou expiré." });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if ((req as AuthRequest).user?.role !== "admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." });
      return;
    }
    next();
  });
}
