import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = fs.readFileSync(path.join(import.meta.dirname, "schema.sql"), "utf8");

// Opens (or creates) the SQLite database and applies schema.sql. Pass
// ":memory:" in tests.
export function openDb(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export type Db = Database.Database;
