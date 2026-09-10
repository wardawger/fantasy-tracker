import express from 'express';
import cors from 'cors';
import { getDb, saveDb } from './database.js';
import { fetchUsers, fetchRosters, fetchWeeklyMatchups, fetchWinnersBracket } from './sleeper.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const KEEPER_ID = '1387435648129966080';
const REDRAFT_ID = '1387433205228896256';
const SURVIVOR_LEAGUE_ID = '1397584028407754752';
const CHOPPED_LEAGUE_ID = '1401420275240738816';
const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

const LEAGUE_DUES = { main: 250, survivor: 50, chopped: 25 };

function mapMemberRow(row) {
  return {
    id: row[0],
    name: row[1],
    sleeper_user_id: row[2],
    total_owed: row[3],
    total_paid: row[4],
    survivor_opted_in: !!row[5],
    chopped_opted_in: !!row[6],
    venmo_username: row[7]
  };
}

async function attachLeaguePaidTotals(db, members) {
  for (const m of members) {
    const survivorResult = await db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'survivor'", [m.id]);
    const choppedResult = await db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'chopped'", [m.id]);
    m.survivor_paid = survivorResult[0]?.values[0]?.[0] || 0;
    m.chopped_paid = choppedResult[0]?.values[0]?.[0] || 0;
  }
  return members;
}

// Initialize Members if table empty
app.get('/api/sync-members', async (req, res) => {
  try {
    const db = await getDb();
    const countResult = await db.exec('SELECT COUNT(*) as count FROM members');
    const count = countResult[0]?.values[0]?.[0] || 0;

    if (count === 0) {
      const users = await fetchUsers(KEEPER_ID);
      for (const u of users) {
        const id = crypto.randomUUID();
        await db.run('INSERT OR IGNORE INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)',
          [id, u.display_name || u.metadata?.team_name || 'Owner', u.user_id]);
      }
      saveDb();
    }
    const listResult = await db.exec('SELECT id, name, sleeper_user_id, total_owed, total_paid, survivor_opted_in, chopped_opted_in, venmo_username FROM members');
    const members = await attachLeaguePaidTotals(db, (listResult[0]?.values.map(mapMemberRow)) || []);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/members', async (req, res) => {
  const db = await getDb();
  const result = await db.exec('SELECT id, name, sleeper_user_id, total_owed, total_paid, survivor_opted_in, chopped_opted_in, venmo_username FROM members');
  const members = await attachLeaguePaidTotals(db, (result[0]?.values.map(mapMemberRow)) || []);
  res.json(members);
});

app.post('/api/members/:id/opt-in', async (req, res) => {
  const { id } = req.params;
  const { league, optedIn } = req.body;

  if (league !== 'survivor' && league !== 'chopped') {
    return res.status(400).json({ error: 'league must be survivor or chopped' });
  }

  const db = await getDb();
  const column = league === 'survivor' ? 'survivor_opted_in' : 'chopped_opted_in';

  try {
    const memberResult = await db.exec('SELECT id FROM members WHERE id = ?', [id]);
    if (!memberResult[0] || memberResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await db.run(`UPDATE members SET ${column} = ? WHERE id = ?`, [optedIn ? 1 : 0, id]);
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/members/:id/venmo', async (req, res) => {
  const { id } = req.params;
  const { venmoUsername } = req.body;

  const db = await getDb();

  try {
    const memberResult = await db.exec('SELECT id FROM members WHERE id = ?', [id]);
    if (!memberResult[0] || memberResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await db.run('UPDATE members SET venmo_username = ? WHERE id = ?', [venmoUsername || null, id]);
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { memberId, amount, date, method, notes, league } = req.body;

  if (league !== undefined && league !== null && league !== '' && LEAGUE_DUES[league] === undefined) {
    return res.status(400).json({ error: 'league must be main, survivor, or chopped' });
  }

  const resolvedLeague = league && LEAGUE_DUES[league] !== undefined ? league : 'main';
  const db = await getDb();

  try {
    const memberResult = await db.exec('SELECT id FROM members WHERE id = ?', [memberId]);
    if (!memberResult[0] || memberResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const id = crypto.randomUUID();
    await db.run('INSERT INTO payments (id, member_id, amount, date, method, notes, league) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, memberId, amount, date, method, notes || '', resolvedLeague]);

    const sumResult = await db.exec("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    await db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
    saveDb();

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, date, method, notes, league } = req.body;

  if (league !== undefined && league !== null && league !== '' && LEAGUE_DUES[league] === undefined) {
    return res.status(400).json({ error: 'league must be main, survivor, or chopped' });
  }

  const db = await getDb();

  try {
    const paymentResult = await db.exec('SELECT member_id, league FROM payments WHERE id = ?', [id]);
    if (!paymentResult[0] || paymentResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const [memberId, existingLeague] = paymentResult[0].values[0];
    const resolvedLeague = league && LEAGUE_DUES[league] !== undefined ? league : existingLeague;

    await db.run('UPDATE payments SET amount = ?, date = ?, method = ?, notes = ?, league = ? WHERE id = ?',
      [amount, date, method, notes || '', resolvedLeague, id]);

    const sumResult = await db.exec("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    await db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
    saveDb();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  const db = await getDb();
  const result = await db.exec(`
    SELECT p.id, p.member_id, p.amount, p.date, p.method, p.notes, m.name as member_name, p.league
    FROM payments p
    JOIN members m ON p.member_id = m.id
    ORDER BY p.date DESC
  `);
  const payments = result[0]?.values.map(row => ({
    id: row[0],
    member_id: row[1],
    amount: row[2],
    date: row[3],
    method: row[4],
    notes: row[5],
    member_name: row[6],
    league: row[7]
  })) || [];
  res.json(payments);
});

app.delete('/api/payments/:id', async (req, res) => {
  const db = await getDb();
  const { id } = req.params;

  try {
    const paymentResult = await db.exec('SELECT member_id FROM payments WHERE id = ?', [id]);
    if (!paymentResult[0] || paymentResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const memberId = paymentResult[0].values[0][0];
    await db.run('DELETE FROM payments WHERE id = ?', [id]);

    const sumResult = await db.exec("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    await db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
    saveDb();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run calculation for a specific week
app.get('/api/refresh/weekly/:week', async (req, res) => {
  const week = parseInt(req.params.week);
  try {
    const matchups = await fetchWeeklyMatchups(REDRAFT_ID, week);
    const scores = matchups.map(m => ({
      roster_id: m.roster_id,
      points: parseFloat(m.points || 0)
    })).sort((a, b) => b.points - a.points);

    if (scores.length < 2) {
      return res.status(400).json({ error: 'Incomplete scores available for this week' });
    }

    const users = await fetchUsers(REDRAFT_ID);
    const rosters = await fetchRosters(REDRAFT_ID);

    const rosterToUserMap = {};
    for (const r of rosters) {
      rosterToUserMap[r.roster_id] = r.owner_id;
    }

    const first = scores[0];
    const second = scores[1];

    const findName = (userId) => {
      const u = users.find(x => x.user_id === userId);
      return u ? u.display_name : 'Unknown';
    };

    const firstUserId = rosterToUserMap[first.roster_id];
    const secondUserId = rosterToUserMap[second.roster_id];

    const db = await getDb();
    await db.run(`
      INSERT OR REPLACE INTO weekly_results (
        id, league, week, first_user_id, first_points, first_payout, first_name,
        second_user_id, second_points, second_payout, second_name, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `${REDRAFT_ID}_${week}`,
      'redraft',
      week,
      firstUserId,
      first.points,
      17.00,
      findName(firstUserId),
      secondUserId,
      second.points,
      8.00,
      findName(secondUserId),
      new Date().toISOString()
    ]);
    saveDb();

    res.json({ success: true, week });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weekly', async (req, res) => {
  const db = await getDb();
  const result = await db.exec('SELECT * FROM weekly_results ORDER BY week');
  const weekly = result[0]?.values.map(row => ({
    id: row[0],
    league: row[1],
    week: row[2],
    first_user_id: row[3],
    first_points: row[4],
    first_payout: row[5],
    first_name: row[6],
    second_user_id: row[7],
    second_points: row[8],
    second_payout: row[9],
    second_name: row[10],
    fetched_at: row[11]
  })) || [];
  res.json(weekly);
});

app.get('/api/champions', async (req, res) => {
  const db = await getDb();
  const result = await db.exec('SELECT league, winner_user_id, winner_name, payout, decided, synced_at FROM league_champions');
  const champions = result[0]?.values.map(row => ({
    league: row[0],
    winner_user_id: row[1],
    winner_name: row[2],
    payout: row[3],
    decided: !!row[4],
    synced_at: row[5]
  })) || [];
  res.json(champions);
});

async function resolveChoppedChampion(db) {
  const bracket = await fetchWinnersBracket(CHOPPED_LEAGUE_ID);
  const finalMatch = (bracket || []).find(m => m.p === 1 && m.w);
  if (!finalMatch) return { decided: false };

  const rosters = await fetchRosters(CHOPPED_LEAGUE_ID);
  const winningRoster = rosters.find(r => r.roster_id === finalMatch.w);
  if (!winningRoster) return { decided: false };

  const memberResult = await db.exec('SELECT name FROM members WHERE sleeper_user_id = ?', [winningRoster.owner_id]);
  const winnerName = memberResult[0]?.values[0]?.[0];
  if (!winnerName) return { decided: false };

  const optedInResult = await db.exec('SELECT COUNT(*) FROM members WHERE chopped_opted_in = 1');
  const payout = (optedInResult[0]?.values[0]?.[0] || 0) * LEAGUE_DUES.chopped;

  return { decided: true, winnerUserId: winningRoster.owner_id, winnerName, payout };
}

async function resolveSurvivorChampion(db) {
  const rosters = await fetchRosters(SURVIVOR_LEAGUE_ID);
  const memberResult = await db.exec('SELECT sleeper_user_id, name FROM members WHERE survivor_opted_in = 1');
  const memberRows = memberResult[0]?.values || [];
  const memberNameByUserId = new Map(memberRows.map(([userId, name]) => [userId, name]));

  const aliveMembers = rosters.filter(r =>
    memberNameByUserId.has(r.owner_id) && r.metadata?.is_eliminated !== 'true'
  );

  if (aliveMembers.length !== 1) return { decided: false };

  const winnerUserId = aliveMembers[0].owner_id;
  const winnerName = memberNameByUserId.get(winnerUserId);

  const optedInResult = await db.exec('SELECT COUNT(*) FROM members WHERE survivor_opted_in = 1');
  const payout = (optedInResult[0]?.values[0]?.[0] || 0) * LEAGUE_DUES.survivor;

  return { decided: true, winnerUserId, winnerName, payout };
}

app.get('/api/refresh/champions/:league', async (req, res) => {
  const { league } = req.params;
  if (league !== 'survivor' && league !== 'chopped') {
    return res.status(400).json({ error: 'league must be survivor or chopped' });
  }

  const db = await getDb();

  try {
    const resolved = league === 'chopped'
      ? await resolveChoppedChampion(db)
      : await resolveSurvivorChampion(db);

    await db.run(`
      INSERT OR REPLACE INTO league_champions (league, winner_user_id, winner_name, payout, decided, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      league,
      resolved.winnerUserId || null,
      resolved.winnerName || null,
      resolved.payout || null,
      resolved.decided ? 1 : 0,
      new Date().toISOString()
    ]);
    saveDb();

    res.json({ success: true, league, decided: resolved.decided });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 20129;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
