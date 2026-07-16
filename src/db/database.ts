import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "../config/env.js";

mkdirSync(path.dirname(env.dbPath), { recursive: true });

export const db = new Database(env.dbPath);
db.pragma("journal_mode = WAL");
