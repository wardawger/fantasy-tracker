import initSqlJs from 'sql.js';
import { createClient } from '@libsql/client';
import fs from 'fs';

let handle = null;
let mode = null; // 'turso' | 'sqljs'
let SQL = null;
let sqljsRaw = null;

export async function getDb(dbPath = 'storage.sqlite') {
  if (handle) return handle;

  if (process.env.TURSO_DATABASE_URL) {
    mode = 'turso';
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });

    handle = {
      async run(sql, params = []) {
        await client.execute({ sql, args: params });
      },
      async exec(sql, params = []) {
        const rs = await client.execute({ sql, args: params });
        if (!rs.rows.length) return [];
        const values = rs.rows.map(row => rs.columns.map(col => row[col]));
        return [{ columns: rs.columns, values }];
      }
    };
  } else {
    mode = 'sqljs';
    if (!SQL) {
      SQL = await initSqlJs();
    }

    if (fs.existsSync(dbPath)) {
      sqljsRaw = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      sqljsRaw = new SQL.Database();
    }
    sqljsRaw.dbPath = dbPath;

    handle = {
      async run(sql, params = []) {
        sqljsRaw.run(sql, params);
      },
      async exec(sql, params = []) {
        return sqljsRaw.exec(sql, params);
      }
    };
  }

  await initDB(handle);
  return handle;
}

async function initDB(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sleeper_user_id TEXT UNIQUE,
      total_owed REAL DEFAULT 250.0,
      total_paid REAL DEFAULT 0.0
    );
  `);

  await db.run(`
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

  await db.run(`
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

  await db.run(`
    CREATE TABLE IF NOT EXISTS league_champions (
      league TEXT PRIMARY KEY,
      winner_user_id TEXT,
      winner_name TEXT,
      payout REAL,
      decided INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT
    );
  `);

  await addColumnIfMissing(db, 'payments', 'league', "TEXT NOT NULL DEFAULT 'main'");
  await addColumnIfMissing(db, 'members', 'survivor_opted_in', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'members', 'chopped_opted_in', 'INTEGER NOT NULL DEFAULT 0');
}

async function addColumnIfMissing(db, table, column, definition) {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) {
      throw err;
    }
  }
}

export function saveDb() {
  if (mode === 'sqljs' && sqljsRaw && sqljsRaw.dbPath) {
    const data = sqljsRaw.export();
    fs.writeFileSync(sqljsRaw.dbPath, data);
  }
  // Turso commits each statement as it runs; nothing to flush.
}

export function getStorageMode() {
  return mode;
}

export function closeDb() {
  if (mode === 'sqljs' && sqljsRaw) {
    saveDb();
    sqljsRaw.close();
  }
  handle = null;
  mode = null;
  sqljsRaw = null;
}
