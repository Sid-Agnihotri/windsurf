import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

/**
 * Local default: SQLite file under ./data/
 * Neon/Postgres: set DATABASE_URL=postgres://... and see README for dialect switch notes.
 * For this MVP the runtime uses SQLite so local and remote deploys run without Neon.
 */
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath =
  process.env.SQLITE_PATH ||
  (process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.replace(/^file:/, "")
    : path.join(dataDir, "windsurf.db"));

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
