import { getDb, closeDb } from '../src/database.js';
import fs from 'fs';

describe('Database Tests', () => {
  const TEST_DB = 'test.sqlite';

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  test('should initialize schema and insert member', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);

    const result = await db.exec('SELECT * FROM members WHERE id = ?', ['1']);
    const member = result[0].values[0];
    expect(member[1]).toBe('Test Member'); // name
    expect(member[3]).toBe(250.0); // total_owed
    expect(member[4]).toBe(0.0); // total_paid
  });

  test('should have league column on payments with default main', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);
    await db.run('INSERT INTO payments (id, member_id, amount, date, method) VALUES (?, ?, ?, ?, ?)', ['p1', '1', 100, '2026-01-01', 'Venmo']);

    const result = await db.exec('SELECT league FROM payments WHERE id = ?', ['p1']);
    expect(result[0].values[0][0]).toBe('main');
  });

  test('should have opt-in columns on members defaulting to 0', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);

    const result = await db.exec('SELECT survivor_opted_in, chopped_opted_in FROM members WHERE id = ?', ['1']);
    expect(result[0].values[0][0]).toBe(0);
    expect(result[0].values[0][1]).toBe(0);
  });

  test('should not error when initDB runs twice against the same db (idempotent migration)', async () => {
    const db = await getDb(TEST_DB);
    // initDB already ran once via getDb(). Re-running it directly must not reject.
    await db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sleeper_user_id TEXT UNIQUE,
        total_owed REAL DEFAULT 250.0,
        total_paid REAL DEFAULT 0.0
      );
    `);
  });

  test('should have league_champions table with defaults', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO league_champions (league) VALUES (?)', ['chopped']);

    const result = await db.exec('SELECT league, winner_user_id, winner_name, payout, decided FROM league_champions WHERE league = ?', ['chopped']);
    const row = result[0].values[0];
    expect(row[0]).toBe('chopped');
    expect(row[1]).toBe(null);
    expect(row[2]).toBe(null);
    expect(row[3]).toBe(null);
    expect(row[4]).toBe(0);
  });

  test('league_champions upsert replaces the prior row for a league (INSERT OR REPLACE pattern)', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO league_champions (league, decided) VALUES (?, ?)', ['survivor', 0]);
    await db.run('INSERT OR REPLACE INTO league_champions (league, winner_name, payout, decided) VALUES (?, ?, ?, ?)',
      ['survivor', 'Test Member', 500, 1]);

    const result = await db.exec('SELECT winner_name, payout, decided FROM league_champions WHERE league = ?', ['survivor']);
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0]).toEqual(['Test Member', 500, 1]);
  });

  test('should have venmo_username column on members defaulting to null', async () => {
    const db = await getDb(TEST_DB);
    await db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);

    const result = await db.exec('SELECT venmo_username FROM members WHERE id = ?', ['1']);
    expect(result[0].values[0][0]).toBe(null);
  });
});
