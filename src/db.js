const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './gleaned.db';
const db = new Database(path.resolve(process.cwd(), dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    org TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('donor','collector')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    donor_username TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    donor_org TEXT NOT NULL,
    food_type TEXT NOT NULL,
    quantity TEXT NOT NULL,
    expiry_time TEXT NOT NULL,
    pickup_window TEXT,
    location TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','claimed','completed')),
    claimed_by_username TEXT,
    claimed_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(donor_username) REFERENCES users(username)
  );

  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_listings_donor ON listings(donor_username);
  CREATE INDEX IF NOT EXISTS idx_listings_claimed_by ON listings(claimed_by_username);
`);

module.exports = db;
