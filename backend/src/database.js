import initSqlJs from 'sql.js';
import fs from 'fs';

let db = null;
let SQL = null;

export async function getDb(dbPath = 'storage.sqlite') {
  if (!db) {
    if (!SQL) {
      SQL = await initSqlJs();
    }

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.dbPath = dbPath;
    initDB(db);
  }
  return db;
}

function initDB(sqliteDb) {
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sleeper_user_id TEXT UNIQUE,
      total_owed REAL DEFAULT 250.0,
      total_paid REAL DEFAULT 0.0
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      method TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS weekly_results (
      id TEXT PRIMARY KEY,
      league TEXT NOT NULL,
      week INTEGER NOT NULL,
      first_user_id TEXT,
      first_points REAL,
      first_payout REAL,
      first_name TEXT,
      second_user_id TEXT,
      second_points REAL,
      second_payout REAL,
      second_name TEXT,
      fetched_at TEXT NOT NULL,
      UNIQUE(league, week)
    );
  `);
}

export function saveDb() {
  if (db && db.dbPath) {
    const data = db.export();
    fs.writeFileSync(db.dbPath, data);
  }
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
