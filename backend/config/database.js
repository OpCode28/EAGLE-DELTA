// eagle-delta/config/database.js
// Local, file-based SQLite connection for the eagle-delta backend.
// No network calls are made here — the database lives entirely on disk.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "eagle-delta.db");
const SCHEMA_PATH = path.join(__dirname, "..", "models", "schema.sql");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`[eagle-delta] schema.sql not found at ${SCHEMA_PATH}`);
    return;
  }
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  console.log("[eagle-delta] schema initialized at", DB_PATH);
}

module.exports = { db, initSchema, DB_PATH };
