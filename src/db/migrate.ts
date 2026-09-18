import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath =
  process.env.SQLITE_PATH ||
  (process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.replace(/^file:/, "")
    : path.join(dataDir, "windsurf.db"));

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
console.log("Migrations applied to", dbPath);
sqlite.close();
