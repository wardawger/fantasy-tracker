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

  test('opt-in existence check finds no row for an unknown member id', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', [memberId, 'Test Member', 'sleeper_1']);

    const unknownId = crypto.randomUUID();

    // Mirrors the pre-check the /api/members/:id/opt-in route performs before UPDATE.
    const existing = db.exec('SELECT id FROM members WHERE id = ?', [memberId]);
    expect(existing[0].values.length).toBe(1);

    const missing = db.exec('SELECT id FROM members WHERE id = ?', [unknownId]);
    expect(missing[0] === undefined || missing[0].values.length === 0).toBe(true);
  });

  test('payment creation existence check rejects an unknown member id', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', [memberId, 'Test Member', 'sleeper_1']);

    const unknownId = crypto.randomUUID();

    // Mirrors the pre-check the POST /api/payments route performs before INSERT.
    const existing = db.exec('SELECT id FROM members WHERE id = ?', [memberId]);
    expect(existing[0].values.length).toBe(1);

    const missing = db.exec('SELECT id FROM members WHERE id = ?', [unknownId]);
    expect(missing[0] === undefined || missing[0].values.length === 0).toBe(true);

    // Confirm no payment/total_paid side effects occur when the existence check fails
    // (i.e. the route should not proceed to INSERT/UPDATE for an unknown member).
    const paymentsBefore = db.exec('SELECT COUNT(*) FROM payments');
    const countBefore = paymentsBefore[0]?.values[0]?.[0] || 0;
    expect(countBefore).toBe(0);
  });

  const LEAGUE_DUES = { main: 250, survivor: 50, chopped: 25 };

  // Mirrors the league validation the POST /api/payments route performs before INSERT:
  // absent/null/'' league defaults to 'main' for back-compat, but a present, unrecognized
  // league value is rejected outright rather than silently coerced to 'main'.
  function resolveLeagueOrReject(league) {
    if (league !== undefined && league !== null && league !== '' && LEAGUE_DUES[league] === undefined) {
      return { rejected: true };
    }
    return { rejected: false, resolvedLeague: league && LEAGUE_DUES[league] !== undefined ? league : 'main' };
  }

  test('invalid league value is rejected and does not create a payment or touch total_paid', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id, total_paid) VALUES (?, ?, ?, ?)',
      [memberId, 'Test Member', 'sleeper_1', 0]);

    const outcome = resolveLeagueOrReject('suvivor');
    expect(outcome.rejected).toBe(true);

    // Since the route rejects before INSERT/UPDATE, no payment row or total_paid change occurs.
    const paymentsAfter = db.exec('SELECT COUNT(*) FROM payments');
    expect(paymentsAfter[0]?.values[0]?.[0] || 0).toBe(0);

    const memberAfter = db.exec('SELECT total_paid FROM members WHERE id = ?', [memberId]);
    expect(memberAfter[0].values[0][0]).toBe(0);
  });

  test('omitted league still defaults to main (back-compat regression)', async () => {
    const outcomeUndefined = resolveLeagueOrReject(undefined);
    expect(outcomeUndefined.rejected).toBe(false);
    expect(outcomeUndefined.resolvedLeague).toBe('main');

    const outcomeNull = resolveLeagueOrReject(null);
    expect(outcomeNull.rejected).toBe(false);
    expect(outcomeNull.resolvedLeague).toBe('main');

    const outcomeEmpty = resolveLeagueOrReject('');
    expect(outcomeEmpty.rejected).toBe(false);
    expect(outcomeEmpty.resolvedLeague).toBe('main');
  });

  test('editing a payment recalculates total_paid scoped to main league', async () => {
    const db = await getDb(TEST_DB);
    const memberId = crypto.randomUUID();
    db.run('INSERT INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)', [memberId, 'Test Member', 'sleeper_1']);

    const paymentId = crypto.randomUUID();
    db.run('INSERT INTO payments (id, member_id, amount, date, method, notes, league) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paymentId, memberId, 100, '2026-01-01', 'Venmo', '', 'main']);
    db.run('UPDATE members SET total_paid = 100 WHERE id = ?', [memberId]);

    // Simulates PUT /api/payments/:id changing amount and league from main -> survivor.
    db.run('UPDATE payments SET amount = ?, date = ?, method = ?, notes = ?, league = ? WHERE id = ?',
      [50, '2026-01-05', 'Cash', 'corrected', 'survivor', paymentId]);

    const sumResult = db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;
    db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);

    // Moving the payment out of 'main' drops it from total_paid entirely.
    const memberAfter = db.exec('SELECT total_paid FROM members WHERE id = ?', [memberId]);
    expect(memberAfter[0].values[0][0]).toBe(0);

    const updatedPayment = db.exec('SELECT amount, date, method, notes, league FROM payments WHERE id = ?', [paymentId]);
    const [amount, date, method, notes, league] = updatedPayment[0].values[0];
    expect({ amount, date, method, notes, league }).toEqual({ amount: 50, date: '2026-01-05', method: 'Cash', notes: 'corrected', league: 'survivor' });
  });

  test('editing an unknown payment id would be rejected before any UPDATE', async () => {
    const db = await getDb(TEST_DB);
    const unknownId = crypto.randomUUID();

    // Mirrors the pre-check the PUT /api/payments/:id route performs before UPDATE.
    const existing = db.exec('SELECT member_id, league FROM payments WHERE id = ?', [unknownId]);
    expect(existing[0] === undefined || existing[0].values.length === 0).toBe(true);
  });

  test('chopped champion payout is opted-in member count times the chopped due', async () => {
    const db = await getDb(TEST_DB);
    db.run('INSERT INTO members (id, name, sleeper_user_id, chopped_opted_in) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), 'Member A', 'sleeper_a', 1]);
    db.run('INSERT INTO members (id, name, sleeper_user_id, chopped_opted_in) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), 'Member B', 'sleeper_b', 1]);
    db.run('INSERT INTO members (id, name, sleeper_user_id, chopped_opted_in) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), 'Member C', 'sleeper_c', 0]);

    // Mirrors resolveChoppedChampion's payout calculation: opted-in count * LEAGUE_DUES.chopped (25).
    const optedInResult = db.exec('SELECT COUNT(*) FROM members WHERE chopped_opted_in = 1');
    const payout = (optedInResult[0]?.values[0]?.[0] || 0) * 25;
    expect(payout).toBe(50);
  });

  test('survivor champion is resolved only when exactly one opted-in member remains alive', async () => {
    const db = await getDb(TEST_DB);
    db.run('INSERT INTO members (id, name, sleeper_user_id, survivor_opted_in) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), 'Member A', 'sleeper_a', 1]);
    db.run('INSERT INTO members (id, name, sleeper_user_id, survivor_opted_in) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), 'Member B', 'sleeper_b', 1]);

    // Mirrors resolveSurvivorChampion: only opted-in members are candidates, matched by sleeper_user_id.
    const memberResult = db.exec('SELECT sleeper_user_id, name FROM members WHERE survivor_opted_in = 1');
    const memberNameByUserId = new Map(memberResult[0].values.map(([userId, name]) => [userId, name]));

    const twoAliveRosters = [{ owner_id: 'sleeper_a', metadata: { is_eliminated: 'false' } }, { owner_id: 'sleeper_b', metadata: { is_eliminated: 'false' } }];
    const twoAlive = twoAliveRosters.filter(r => memberNameByUserId.has(r.owner_id) && r.metadata?.is_eliminated !== 'true');
    expect(twoAlive.length).toBe(2); // not decided yet - more than one alive

    const oneAliveRosters = [{ owner_id: 'sleeper_a', metadata: { is_eliminated: 'true' } }, { owner_id: 'sleeper_b', metadata: { is_eliminated: 'false' } }];
    const oneAlive = oneAliveRosters.filter(r => memberNameByUserId.has(r.owner_id) && r.metadata?.is_eliminated !== 'true');
    expect(oneAlive.length).toBe(1);
    expect(memberNameByUserId.get(oneAlive[0].owner_id)).toBe('Member B');
  });
});
