import express from 'express';
import cors from 'cors';
import { getDb, saveDb } from './database.js';
import { fetchUsers, fetchRosters, fetchWeeklyMatchups } from './sleeper.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const KEEPER_ID = '1387435648129966080';
const REDRAFT_ID = '1387433205228896256';
const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

// Initialize Members if table empty
app.get('/api/sync-members', async (req, res) => {
  try {
    const db = await getDb();
    const countResult = db.exec('SELECT COUNT(*) as count FROM members');
    const count = countResult[0]?.values[0]?.[0] || 0;

    if (count === 0) {
      const users = await fetchUsers(KEEPER_ID);
      for (const u of users) {
        const id = crypto.randomUUID();
        db.run('INSERT OR IGNORE INTO members (id, name, sleeper_user_id) VALUES (?, ?, ?)',
          [id, u.display_name || u.metadata?.team_name || 'Owner', u.user_id]);
      }
      saveDb();
    }
    const listResult = db.exec('SELECT * FROM members');
    const members = listResult[0]?.values.map(row => ({
      id: row[0],
      name: row[1],
      sleeper_user_id: row[2],
      total_owed: row[3],
      total_paid: row[4]
    })) || [];
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/members', async (req, res) => {
  const db = await getDb();
  const result = db.exec('SELECT * FROM members');
  const members = result[0]?.values.map(row => ({
    id: row[0],
    name: row[1],
    sleeper_user_id: row[2],
    total_owed: row[3],
    total_paid: row[4]
  })) || [];
  res.json(members);
});

app.post('/api/payments', async (req, res) => {
  const { memberId, amount, date, method, notes } = req.body;
  const db = await getDb();

  try {
    const id = crypto.randomUUID();
    db.run('INSERT INTO payments (id, member_id, amount, date, method, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, memberId, amount, date, method, notes || '']);

    const sumResult = db.exec('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ?', [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
    saveDb();

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  const db = await getDb();
  const result = db.exec(`
    SELECT p.id, p.member_id, p.amount, p.date, p.method, p.notes, m.name as member_name
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
    member_name: row[6]
  })) || [];
  res.json(payments);
});

app.delete('/api/payments/:id', async (req, res) => {
  const db = await getDb();
  const { id } = req.params;

  try {
    const paymentResult = db.exec('SELECT member_id FROM payments WHERE id = ?', [id]);
    if (!paymentResult[0] || paymentResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const memberId = paymentResult[0].values[0][0];
    db.run('DELETE FROM payments WHERE id = ?', [id]);

    const sumResult = db.exec('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ?', [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
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
    db.run(`
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
  const result = db.exec('SELECT * FROM weekly_results ORDER BY week');
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

const PORT = process.env.PORT || 20129;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
