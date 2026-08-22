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
});
