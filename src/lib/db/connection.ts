import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";

const DB_FILENAME = "hermes.db";

let db: Database.Database | null = null;

/**
 * Returns a singleton SQLite connection. On first call, creates the database
 * file in the project root (or DATA_DIR if set) and runs schema migrations.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dir = process.env.DATA_DIR || process.cwd();
  const dbPath = path.join(dir, DB_FILENAME);

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  initSchema(db);
  return db;
}

/** For tests: close and reset the singleton. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
