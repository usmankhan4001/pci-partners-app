import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { db } from "./database.js";

export type InternalUserRole = "admin" | "rep";

export interface InternalUserRecord {
  id: string;
  username: string;
  display_name: string;
  role: InternalUserRole;
  password_hash: string;
  active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedInternalUser {
  id: string;
  username: string;
  display_name: string;
  role: InternalUserRole;
}

interface SeedInternalUser {
  username: string;
  displayName: string;
  password: string;
  role: InternalUserRole;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS internal_users (
    id text PRIMARY KEY,
    username text UNIQUE NOT NULL,
    display_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'rep',
    password_hash text NOT NULL DEFAULT '',
    active integer NOT NULL DEFAULT 1,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );
`);

const existingColumns = new Set((db.prepare(`PRAGMA table_info(internal_users)`).all() as Array<{ name: string }>).map((c) => c.name));
if (!existingColumns.has("display_name")) {
  db.exec(`ALTER TABLE internal_users ADD COLUMN display_name text NOT NULL DEFAULT ''`);
}
if (!existingColumns.has("role")) {
  db.exec(`ALTER TABLE internal_users ADD COLUMN role text NOT NULL DEFAULT 'rep'`);
}
if (!existingColumns.has("password_hash")) {
  db.exec(`ALTER TABLE internal_users ADD COLUMN password_hash text NOT NULL DEFAULT ''`);
}
if (!existingColumns.has("active")) {
  db.exec(`ALTER TABLE internal_users ADD COLUMN active integer NOT NULL DEFAULT 1`);
}

const findByUsernameStmt = db.prepare(`SELECT * FROM internal_users WHERE username = ? AND active = 1`);
const countUsersStmt = db.prepare(`SELECT COUNT(*) as count FROM internal_users WHERE active = 1`);
const upsertUserStmt = db.prepare(`
  INSERT INTO internal_users (id, username, display_name, role, password_hash, active, created_at, updated_at)
  VALUES (@id, @username, @display_name, @role, @password_hash, 1, @created_at, @updated_at)
  ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    role = excluded.role,
    password_hash = excluded.password_hash,
    active = 1,
    updated_at = excluded.updated_at
`);

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, salt, expectedHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function parseSeedUsers(): SeedInternalUser[] {
  const seededUsers: SeedInternalUser[] = [];
  const raw = env.internalUsers.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`INTERNAL_USERS must be valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("INTERNAL_USERS must be a JSON array of { username, password, role, displayName? } objects.");
    }
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        throw new Error("Each INTERNAL_USERS entry must be an object.");
      }
      const candidate = item as Record<string, unknown>;
      const username = normalizeUsername(String(candidate.username || ""));
      const password = String(candidate.password || "");
      const role = candidate.role === "admin" ? "admin" : candidate.role === "rep" ? "rep" : "";
      const displayName = String(candidate.displayName || candidate.display_name || candidate.username || "").trim();
      if (!username || !password || !role || !displayName) {
        throw new Error("Each INTERNAL_USERS entry needs username, password, role (admin|rep), and displayName.");
      }
      seededUsers.push({ username, password, role, displayName });
    }
  }

  if (!raw && env.internalBasicAuthUser && env.internalBasicAuthPass) {
    seededUsers.push({
      username: normalizeUsername(env.internalBasicAuthUser),
      displayName: env.internalBasicAuthUser.trim(),
      password: env.internalBasicAuthPass,
      role: "admin",
    });
  }

  return seededUsers;
}

function seedInternalUsers(users: SeedInternalUser[]) {
  const now = new Date().toISOString();
  const insertMany = db.transaction((rows: SeedInternalUser[]) => {
    for (const user of rows) {
      upsertUserStmt.run({
        id: randomUUID(),
        username: normalizeUsername(user.username),
        display_name: user.displayName,
        role: user.role,
        password_hash: hashPassword(user.password),
        created_at: now,
        updated_at: now,
      });
    }
  });
  insertMany(users);
}

seedInternalUsers(parseSeedUsers());

export function hasInternalUsersConfigured(): boolean {
  return ((countUsersStmt.get() as { count: number } | undefined)?.count || 0) > 0;
}

export function authenticateInternalUser(username: string, password: string): AuthenticatedInternalUser | undefined {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) return undefined;
  const user = findByUsernameStmt.get(normalizedUsername) as InternalUserRecord | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) return undefined;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
  };
}
