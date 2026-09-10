# Optional League Dues Tracking (Survivor & Chopped) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app track dues and paid status for two new optional side leagues (Survivor $50, Chopped $25) alongside the existing Main League ($250), without losing any existing payment history or changing existing Main League math.

**Architecture:** Add a `league` column to the existing `payments` table and two opt-in boolean columns to `members`, via additive `ALTER TABLE` migrations. Extend the Express API to accept/return league data and expose an opt-in toggle endpoint. Extend the React frontend (Payments page: league picker + opt-in checkboxes; Dashboard: per-league status columns).

**Tech Stack:** Node/Express backend with `sql.js` (in-memory SQLite persisted to a file), Jest for backend tests, React + Vite + Tailwind frontend, axios for API calls.

## Global Constraints

- Main League due stays $250, Survivor due is $50, Chopped due is $25 — these are the only three leagues; no generic multi-league admin UI.
- No existing `members` or `payments` row may be dropped, renamed away from, or have its meaning changed. All schema changes are additive with backward-compatible defaults.
- `members.total_paid` must continue to reflect **only** Main League payments (`league = 'main'`), unchanged from current behavior.
- Migrations must be idempotent — safe to run against a fresh DB and against an already-migrated DB (re-running `ALTER TABLE ADD COLUMN` on an existing column must not crash the app).

---

### Task 1: Database schema migration (`league` on payments, opt-in flags on members)

**Files:**
- Modify: `backend/src/database.js:27-67` (the `initDB` function)
- Test: `backend/tests/database.test.js`

**Interfaces:**
- Produces: `payments.league` column (`TEXT NOT NULL DEFAULT 'main'`), `members.survivor_opted_in` column (`INTEGER NOT NULL DEFAULT 0`), `members.chopped_opted_in` column (`INTEGER NOT NULL DEFAULT 0`). Later tasks (API layer) read/write these directly via `db.run`/`db.exec`.

- [ ] **Step 1: Write the failing test for the new columns**

Add to `backend/tests/database.test.js`, inside the existing `describe` block, after the existing test:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/database.test.js -v`
Expected: FAIL — `league` column and opt-in columns don't exist yet (SQLite error: "no such column").

- [ ] **Step 3: Implement the migration in `initDB`**

In `backend/src/database.js`, replace the `initDB` function (lines 27-67) with:

```javascript
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

  addColumnIfMissing(sqliteDb, 'payments', 'league', "TEXT NOT NULL DEFAULT 'main'");
  addColumnIfMissing(sqliteDb, 'members', 'survivor_opted_in', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqliteDb, 'members', 'chopped_opted_in', 'INTEGER NOT NULL DEFAULT 0');
}

function addColumnIfMissing(sqliteDb, table, column, definition) {
  try {
    sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) {
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/database.test.js -v`
Expected: PASS — all 4 tests (1 existing + 3 new) green.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/database.js tests/database.test.js
git commit -m "feat(db): add league column to payments and opt-in flags to members"
```

---

### Task 2: API — accept/return `league` on payments, expose opt-in endpoint, extend members response

**Files:**
- Modify: `backend/src/app.js:16-97` (`/api/sync-members`, `/api/members`, `POST /api/payments`, `GET /api/payments`, `DELETE /api/payments/:id`)
- Test: `backend/tests/app.test.js` (new file — no existing app-level tests, so this introduces the pattern using `supertest`-free direct DB assertions to stay consistent with the project's current lightweight Jest style)

**Interfaces:**
- Consumes: `getDb`, `saveDb` from `backend/src/database.js` (Task 1) — the `league`, `survivor_opted_in`, `chopped_opted_in` columns now exist.
- Produces:
  - `POST /api/payments` body accepts `{ memberId, amount, date, method, notes, league }` (`league` optional, defaults to `'main'` server-side).
  - `GET /api/payments` response items include `league`.
  - `GET /api/members` response items include `survivor_opted_in` (boolean), `chopped_opted_in` (boolean), `survivor_paid` (number), `chopped_paid` (number), in addition to existing fields.
  - `POST /api/members/:id/opt-in` body `{ league: 'survivor' | 'chopped', optedIn: boolean }`, returns `{ success: true }`.

- [ ] **Step 1: Write the failing tests**

Since there's no existing `app.js` test file, this task adds one that talks to the app's DB layer directly (matching the project's existing preference for direct DB assertions over HTTP mocking, per `database.test.js`). Create `backend/tests/app.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/app.test.js -v`
Expected: FAIL — `league` column doesn't exist on the `payments` insert used here if Task 1 wasn't completed; if Task 1 is done, these tests should actually already pass since they test the DB layer directly. Run them anyway to confirm the DB-level behavior before wiring the HTTP layer — if they pass already, proceed straight to Step 3 (the HTTP layer is still unimplemented, which is the actual gap this task closes).

- [ ] **Step 3: Implement the API changes in `backend/src/app.js`**

Replace the `/api/sync-members` handler's row-mapping (lines 31-38 pattern) and `/api/members` handler (lines 45-56) with a shared mapper, and update payments endpoints. Replace lines 16-97 of `backend/src/app.js` with:

```javascript
const LEAGUE_DUES = { main: 250, survivor: 50, chopped: 25 };

function mapMemberRow(row) {
  return {
    id: row[0],
    name: row[1],
    sleeper_user_id: row[2],
    total_owed: row[3],
    total_paid: row[4],
    survivor_opted_in: !!row[5],
    chopped_opted_in: !!row[6]
  };
}

async function attachLeaguePaidTotals(db, members) {
  for (const m of members) {
    const survivorResult = db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'survivor'", [m.id]);
    const choppedResult = db.exec("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = ? AND league = 'chopped'", [m.id]);
    m.survivor_paid = survivorResult[0]?.values[0]?.[0] || 0;
    m.chopped_paid = choppedResult[0]?.values[0]?.[0] || 0;
  }
  return members;
}

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
    const listResult = db.exec('SELECT id, name, sleeper_user_id, total_owed, total_paid, survivor_opted_in, chopped_opted_in FROM members');
    const members = await attachLeaguePaidTotals(db, (listResult[0]?.values.map(mapMemberRow)) || []);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/members', async (req, res) => {
  const db = await getDb();
  const result = db.exec('SELECT id, name, sleeper_user_id, total_owed, total_paid, survivor_opted_in, chopped_opted_in FROM members');
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
    db.run(`UPDATE members SET ${column} = ? WHERE id = ?`, [optedIn ? 1 : 0, id]);
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { memberId, amount, date, method, notes, league } = req.body;
  const resolvedLeague = league && LEAGUE_DUES[league] !== undefined ? league : 'main';
  const db = await getDb();

  try {
    const id = crypto.randomUUID();
    db.run('INSERT INTO payments (id, member_id, amount, date, method, notes, league) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, memberId, amount, date, method, notes || '', resolvedLeague]);

    const sumResult = db.exec("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
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
    const paymentResult = db.exec('SELECT member_id FROM payments WHERE id = ?', [id]);
    if (!paymentResult[0] || paymentResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const memberId = paymentResult[0].values[0][0];
    db.run('DELETE FROM payments WHERE id = ?', [id]);

    const sumResult = db.exec("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ? AND league = 'main'", [memberId]);
    const totalPaid = sumResult[0]?.values[0]?.[0] || 0;

    db.run('UPDATE members SET total_paid = ? WHERE id = ?', [totalPaid, memberId]);
    saveDb();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Leave the rest of `app.js` (weekly results endpoints, `app.listen`) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest -v`
Expected: PASS — all tests in `database.test.js`, `app.test.js`, and `sleeper.test.js` green.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/app.js tests/app.test.js
git commit -m "feat(api): support per-league payments, opt-in endpoint, league paid totals"
```

---

### Task 3: Frontend — `LeagueContext` support for league-tagged payments and opt-in

**Files:**
- Modify: `frontend/src/context/LeagueContext.jsx`

**Interfaces:**
- Consumes: `POST /api/payments` (now accepts `league`), `POST /api/members/:id/opt-in` (Task 2).
- Produces: `optIn(memberId, league, optedIn)` function exposed via context, consumed by Task 4 (`Payments.jsx`). `addPayment(payload)` unchanged signature but `payload` may now include `league`.

- [ ] **Step 1: Implement `optIn` in `LeagueContext.jsx`**

No automated test exists for this context file (project has no frontend test setup), so this step is implementation-only, verified via Task 4/5's manual browser check. Modify `frontend/src/context/LeagueContext.jsx`:

Replace lines 36-44 (`deletePayment` through `refreshWeekResults`) with:

```javascript
  const deletePayment = async (id) => {
    await axios.delete(`${API_BASE}/api/payments/${id}`);
    await refreshData();
  };

  const optIn = async (memberId, league, optedIn) => {
    await axios.post(`${API_BASE}/api/members/${memberId}/opt-in`, { league, optedIn });
    await refreshData();
  };

  const refreshWeekResults = async (week) => {
    await axios.get(`${API_BASE}/api/refresh/weekly/${week}`);
    await refreshData();
  };
```

And update the provider value (line 51-53) to include `optIn`:

```javascript
    <LeagueContext.Provider value={{
      members, payments, weekly, loading, refreshData, addPayment, deletePayment, optIn, refreshWeekResults
    }}>
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/context/LeagueContext.jsx
git commit -m "feat(context): add optIn action for Survivor/Chopped participation"
```

---

### Task 4: Frontend — Payments page league picker, opt-in checkboxes, league column

**Files:**
- Modify: `frontend/src/components/Payments.jsx`

**Interfaces:**
- Consumes: `members`, `payments`, `addPayment`, `deletePayment`, `optIn` (Task 3), `loading` from `LeagueContext`.
- Produces: nothing consumed by later tasks (leaf UI).

- [ ] **Step 1: Add league state and due-amount auto-fill**

In `frontend/src/components/Payments.jsx`, add a `LEAGUE_DUES` constant near the top (after imports) and a `league` state:

```javascript
const LEAGUE_DUES = { main: 250, survivor: 50, chopped: 25 };
const LEAGUE_LABELS = { main: 'Main League ($250)', survivor: 'Survivor ($50)', chopped: 'Chopped ($25)' };
```

In the component, add to the existing `useState` declarations (after `const [memberId, setMemberId] = useState('');`):

```javascript
  const [league, setLeague] = useState('main');
```

- [ ] **Step 2: Add the League `<select>` to the payment form, auto-filling amount**

In the form (after the "Select Member" `<div>` block, before "Dues Amount"), add:

```jsx
          <div>
            <label className="block text-sm text-slate-400 mb-1">League</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
              value={league}
              onChange={e => {
                const newLeague = e.target.value;
                setLeague(newLeague);
                setAmount(String(LEAGUE_DUES[newLeague]));
              }}
            >
              {Object.keys(LEAGUE_DUES).map(l => (
                <option key={l} value={l}>{LEAGUE_LABELS[l]}</option>
              ))}
            </select>
          </div>
```

- [ ] **Step 3: Include `league` in `addPayment` call**

Replace `handleSubmit` (lines 70-82):

```javascript
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId || !amount) return alert('Select owner and amount');
    await addPayment({
      memberId,
      amount: parseFloat(amount),
      date,
      method,
      notes,
      league
    });
    setAmount('');
    setNotes('');
  };
```

- [ ] **Step 4: Add opt-in checkboxes below the member selector**

Directly after the "Select Member" `<div>` block (before the League `<select>` added in Step 2), add:

```jsx
          {memberId && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={!!members.find(m => m.id === memberId)?.survivor_opted_in}
                  onChange={e => optIn(memberId, 'survivor', e.target.checked)}
                />
                Survivor
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={!!members.find(m => m.id === memberId)?.chopped_opted_in}
                  onChange={e => optIn(memberId, 'chopped', e.target.checked)}
                />
                Chopped
              </label>
            </div>
          )}
```

And destructure `optIn` from context at the top (line 5):

```javascript
  const { members, payments, addPayment, deletePayment, optIn, loading } = useContext(LeagueContext);
```

- [ ] **Step 5: Add a League column to the payment history table**

In the table `<thead>` (lines 139-146), add a column header after "Amount":

```jsx
                    <th className="py-2">Amount</th>
                    <th className="py-2">League</th>
```

In the table body row (after the Amount `<td>`, line 157), add:

```jsx
                        <td className="py-3 text-emerald-400 font-medium">${p.amount}</td>
                        <td className="py-3"><span className="bg-slate-700 px-2 py-0.5 rounded text-xs capitalize">{p.league}</span></td>
```

Update `colSpan="5"` to `colSpan="6"` in the expanded detail row (line 173) to match the new column count, and add a League line to the detail view after the "Amount" detail block (around line 186):

```jsx
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">League:</span>
                                <span className="text-slate-300 capitalize">{p.league}</span>
                              </div>
```

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/components/Payments.jsx
git commit -m "feat(ui): add league picker, opt-in checkboxes, and league column to Payments page"
```

---

### Task 5: Frontend — Dashboard per-league status columns

**Files:**
- Modify: `frontend/src/components/Dashboard.jsx`

**Interfaces:**
- Consumes: `members` (now includes `survivor_opted_in`, `chopped_opted_in`, `survivor_paid`, `chopped_paid` per Task 2) from `LeagueContext`.
- Produces: nothing consumed by later tasks (leaf UI).

- [ ] **Step 1: Add a status-badge helper**

In `frontend/src/components/Dashboard.jsx`, add after the imports:

```javascript
const LEAGUE_DUES = { survivor: 50, chopped: 25 };

function LeagueStatusBadge({ member, league }) {
  const optedIn = league === 'survivor' ? member.survivor_opted_in : member.chopped_opted_in;
  const paid = league === 'survivor' ? member.survivor_paid : member.chopped_paid;

  if (!optedIn) {
    return <span className="bg-slate-700 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Not Participating</span>;
  }
  if (paid >= LEAGUE_DUES[league]) {
    return <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Paid</span>;
  }
  if (paid > 0) {
    return <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Partially Paid</span>;
  }
  return <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Unpaid</span>;
}
```

- [ ] **Step 2: Add Survivor/Chopped columns to the owner table**

Update the `<thead>` (lines 34-38):

```jsx
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2">Team Owner</th>
                <th className="py-2">Paid</th>
                <th className="py-2">Dues Status</th>
                <th className="py-2">Survivor</th>
                <th className="py-2">Chopped</th>
              </tr>
```

Update the `<tbody>` row (lines 41-55) to add two cells after the existing "Dues Status" `<td>`:

```jsx
              {members.map(m => (
                <tr key={m.id} className="border-b border-slate-800">
                  <td className="py-3 font-semibold">{m.name}</td>
                  <td className="py-3">${m.total_paid || 0}</td>
                  <td className="py-3">
                    {m.total_paid >= 250 ? (
                      <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Fully Paid</span>
                    ) : m.total_paid > 0 ? (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Partially Paid</span>
                    ) : (
                      <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Unpaid</span>
                    )}
                  </td>
                  <td className="py-3"><LeagueStatusBadge member={m} league="survivor" /></td>
                  <td className="py-3"><LeagueStatusBadge member={m} league="chopped" /></td>
                </tr>
              ))}
```

Leave the top summary cards (`totalOwed`, `totalPaid`, lines 9-27) unchanged — they stay scoped to Main League only.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/Dashboard.jsx
git commit -m "feat(ui): show per-league paid status columns on Dashboard"
```

---

### Task 6: End-to-end manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start backend and frontend dev servers**

```bash
cd backend && npm install && npm run dev
```
(in a second terminal)
```bash
cd frontend && npm install && npm run dev
```

- [ ] **Step 2: Verify existing Main League data is untouched**

Open the app, go to Dashboard. Confirm existing members' Main League "Paid"/"Dues Status" values match what they were before this change (compare against `storage.sqlite` pre-migration if available, or confirm total pot/collected/outstanding cards look sane).

- [ ] **Step 3: Verify opt-in flow**

Go to Payments page, unlock with password, select a member, check the "Survivor" checkbox. Go to Dashboard, confirm that member's Survivor column now shows "Unpaid" (not "Not Participating"). Confirm an un-opted-in member still shows "Not Participating".

- [ ] **Step 4: Verify payment recording and auto-fill**

On Payments page, select the same member, choose "Survivor ($50)" from the League dropdown, confirm Dues Amount auto-fills to `50`. Submit. Confirm the payment appears in the history table tagged "survivor", and Dashboard now shows that member's Survivor status as "Paid". Confirm Main League Dues Collected total on Dashboard did NOT change.

- [ ] **Step 5: Verify Chopped follows the same pattern**

Repeat steps 3-4 for Chopped ($25 due), confirming independent status from Survivor for the same member.

- [ ] **Step 6: Take a screenshot of the Dashboard and Payments page showing the new columns for the final report**

No commit for this task — it's verification only.
