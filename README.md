# Fantasy Football League Payment Tracker

A web-based payment and payout tracker for managing dues and weekly payouts across two 10-person Sleeper fantasy football leagues (Keeper and Redraft).

## Features

- **Payment Tracking**: Record and manage $250 league dues per member with payment history
- **Dashboard**: Real-time overview of collected dues, outstanding balances, and payment status
- **Weekly Payouts**: Automatic calculation of weekly winners from Sleeper API (Redraft league only)
- **Payout Ledger**: Net balance calculator showing payments in vs. payouts owed
- **Sleeper Integration**: Live data fetching from Sleeper API for rosters, users, and matchup scores

## League Structure

### Both Leagues (Keeper & Redraft)
- 10 teams per league
- $250 total buy-in per person ($125 per league)
- End-of-season payouts: $700 (1st), $200 (2nd), $100 (3rd)

### Redraft League Specific
- Weekly payouts (Weeks 1-14): $17 (1st highest score), $8 (2nd highest score)
- Season bonuses: $50 (best record), $50 (highest single week), $50 (most season points)

## Tech Stack

**Backend:**
- Node.js + Express
- SQLite (via sql.js)
- Sleeper API integration

**Frontend:**
- React + Vite
- Tailwind CSS
- React Router
- Axios

## Setup

### Backend

```bash
cd backend
npm install
npm run dev  # Development server on port 20129
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Development server on port 5173
```

### Environment Variables

Create `backend/.env`:
```
PORT=20129
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:20129
```

## Deployment

### Backend (Railway/Render)
1. Push to GitHub
2. Connect repository to Railway or Render
3. Set environment variables
4. Deploy backend service

### Frontend (Netlify)
1. Build: `npm run build`
2. Publish directory: `dist`
3. Set `VITE_API_URL` environment variable to backend URL
4. Deploy

## API Endpoints

- `GET /api/sync-members` - Initialize members from Sleeper
- `GET /api/members` - List all members
- `POST /api/payments` - Record a payment
- `GET /api/payments` - List all payments
- `DELETE /api/payments/:id` - Delete a payment
- `GET /api/refresh/weekly/:week` - Calculate weekly winners
- `GET /api/weekly` - List all weekly results

## League IDs

- Keeper: `1387435648129966080`
- Redraft: `1387433205228896256`

## Development

Built with ❤️ by Warren Wilson ([@wardawger](https://github.com/wardawger))

## License

MIT
