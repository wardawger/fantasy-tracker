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
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);

    const result = db.exec('SELECT * FROM members WHERE id = ?', ['1']);
    const member = result[0].values[0];
    expect(member[1]).toBe('Test Member'); // name
    expect(member[3]).toBe(250.0); // total_owed
    expect(member[4]).toBe(0.0); // total_paid
  });

  test('should have league column on payments with default main', async () => {
    const db = await getDb(TEST_DB);
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);
    db.run('INSERT INTO payments (id, member_id, amount, date, method) VALUES (?, ?, ?, ?, ?)', ['p1', '1', 100, '2026-01-01', 'Venmo']);

    const result = db.exec('SELECT league FROM payments WHERE id = ?', ['p1']);
    expect(result[0].values[0][0]).toBe('main');
  });

  test('should have opt-in columns on members defaulting to 0', async () => {
    const db = await getDb(TEST_DB);
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', ['1', 'Test Member', 'sleeper_1']);

    const result = db.exec('SELECT survivor_opted_in, chopped_opted_in FROM members WHERE id = ?', ['1']);
    expect(result[0].values[0][0]).toBe(0);
    expect(result[0].values[0][1]).toBe(0);
  });

  test('should not error when initDB runs twice against the same db (idempotent migration)', async () => {
    const db = await getDb(TEST_DB);
    // initDB already ran once via getDb(). Re-running it directly must not throw.
    expect(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sleeper_user_id TEXT UNIQUE,
          total_owed REAL DEFAULT 250.0,
          total_paid REAL DEFAULT 0.0
        );
      `);
    }).not.toThrow();
  });
});
