import { getDb, closeDb } from '../src/database.js';
import fs from 'fs';
import crypto from 'crypto';

describe('League dues logic', () => {
  const TEST_DB = 'test-app.sqlite';

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  test('total_paid only sums main league payments', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', [memberId, 'Test Member', 'sleeper_1']);

    db.run('INSERT INTO payments (id, member_id, amount, date, method, league) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), memberId, 250, '2026-01-01', 'Venmo', 'main']);
    db.run('INSERT INTO payments (id, member_id, amount, date, method, league) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), memberId, 50, '2026-01-02', 'Venmo', 'survivor']);

    const mainSum = db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    expect(mainSum[0].values[0][0]).toBe(250);

    const survivorSum = db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'survivor'", [memberId]);
    expect(survivorSum[0].values[0][0]).toBe(50);
  });

  test('opt-in flags update independently per league', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', [memberId, 'Test Member', 'sleeper_1']);

    db.run('UPDATE members SET survivor_opted_in = 1 WHERE id = ?', [memberId]);

    const result = db.exec('SELECT survivor_opted_in, chopped_opted_in FROM members WHERE id = ?', [memberId]);
    expect(result[0].values[0][0]).toBe(1);
    expect(result[0].values[0][1]).toBe(0);
  });
});
