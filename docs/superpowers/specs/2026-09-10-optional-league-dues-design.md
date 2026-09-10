# Optional League Dues Tracking (Survivor & Chopped)

## Context

The league added two new optional side pots this season:
- **Survivor** — $50/person
- **Chopped** — $25/person

The existing app only tracks one flat due ($250/member) for the main redraft league, via `members.total_owed`/`members.total_paid` and a generic `payments` table. Participation in Survivor/Chopped is optional (not every member joins), so payment tracking must distinguish "not participating" from "participating but unpaid."

## Goals

- Track payments per league (Main / Survivor / Chopped) without losing any existing payment history.
- Track which members opted into Survivor and/or Chopped.
- Surface paid/unpaid/not-participating status per league on the Dashboard.
- Let the person recording payments pick a league on the payment form, with the dues amount auto-filled per league (still editable).

## Non-goals

- No changes to how the main $250 due is calculated or displayed (existing behavior is preserved exactly).
- No general-purpose "add arbitrary league" admin UI — Main/Survivor/Chopped are hardcoded for now, matching how the existing app hardcodes league IDs (`KEEPER_ID`/`REDRAFT_ID`) and the $250 due.

## Data model changes

### `payments` table
Add `league TEXT NOT NULL DEFAULT 'main'`, one of `'main' | 'survivor' | 'chopped'`.

Migration: since the app uses `sql.js` and re-runs `CREATE TABLE IF NOT EXISTS` on every boot (a no-op against an existing table), adding a new column requires an explicit `ALTER TABLE payments ADD COLUMN league TEXT NOT NULL DEFAULT 'main'` guarded in a try/catch (SQLite errors if the column already exists; that error is the "already migrated" signal and is safely ignored). Existing rows backfill to `'main'` automatically via the column default — no data loss, no existing payment reassigned to the wrong league.

### `members` table
Add two columns via the same `ALTER TABLE ... ADD COLUMN` + try/catch pattern:
- `survivor_opted_in INTEGER NOT NULL DEFAULT 0`
- `chopped_opted_in INTEGER NOT NULL DEFAULT 0`

Existing members default to not-opted-in for both, which is correct (nobody was in these leagues before this change).

## Backend API changes (`backend/src/app.js`)

- **`POST /api/payments`**: accept `league` in the request body (default `'main'` if omitted, for backwards compatibility with any stale client). Store it on the payment row.
  - `total_paid` on `members` continues to be computed as the sum of only `league = 'main'` payments, so the Dashboard's existing $250 math is untouched.
- **`GET /api/members`**: extend the response to include `survivor_opted_in`, `chopped_opted_in`, `survivor_paid` (sum of that member's `league='survivor'` payments), and `chopped_paid` (sum of `league='chopped'` payments). This lets the frontend render status without re-deriving it from the full payments list.
- **`POST /api/members/:id/opt-in`**: body `{ league: 'survivor' | 'chopped', optedIn: boolean }`. Updates the corresponding column on `members` and returns the updated member.
- **`GET /api/payments`**: include `league` in each returned payment object (for the payment history table/detail view).
- **`DELETE /api/payments/:id`**: unchanged in shape; still recomputes `total_paid` from `league='main'` payments only after delete.

## Frontend changes

### `Payments.jsx`
- Add a **League** `<select>` to the payment form: `Main League ($250)`, `Survivor ($50)`, `Chopped ($25)`. On change, auto-fill the Dues Amount field with that league's due (250/50/25) — the amount field remains editable in case of partial payments.
- Include `league` in the `addPayment` call.
- Add a compact opt-in control (two checkboxes: Survivor, Chopped) next to the member selector, calling the new opt-in endpoint and updating local state via context.
- Payment history table: add a **League** column/badge (reuse the existing "Protocol"-badge visual style) so historical entries are distinguishable; include `league` in the expandable detail row.

### `Dashboard.jsx`
- Extend the existing owner table with two new columns, **Survivor** and **Chopped**, alongside the existing Main League status column. Per member, per league:
  - Not opted in → gray "Not Participating" badge.
  - Opted in, `paid < due` → red/yellow badge ("Unpaid"/"Partial") consistent with existing Main League badge logic.
  - Opted in, `paid >= due` → green "Paid" badge.
- Top summary cards (Total Pot / Dues Collected / Outstanding) stay scoped to the Main League only, matching current behavior — no change to those numbers.

### `LeagueContext` (frontend/src/context)
- Extend `addPayment` to pass through `league`.
- Add an `optIn(memberId, league, optedIn)` function that calls the new endpoint and refreshes `members` state.

## Data integrity / rollback safety

- All schema changes are additive (`ALTER TABLE ... ADD COLUMN` with defaults); no existing column is dropped or renamed, no existing row is modified beyond receiving default values for new columns.
- If the ALTER fails because the column already exists (re-deploy scenario), the try/catch swallows that specific "duplicate column" case and continues — same idempotent pattern already implied by `CREATE TABLE IF NOT EXISTS` elsewhere in this file.

## Testing

- Extend `backend/tests/database.test.js` to cover: new columns exist after `initDB`, migration is idempotent (running init twice doesn't error), `total_paid` is unaffected by non-`main` payments.
- Manual verification in the browser: opt a member into Survivor, record a partial and then full payment, confirm Dashboard badge transitions Not Participating → Unpaid → Paid, and confirm Main League numbers are untouched throughout.
