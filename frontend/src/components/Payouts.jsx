import React, { useContext, useState } from 'react';
import { LeagueContext } from '../context/LeagueContext';

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

export default function Payouts() {
  const { members, weekly, refreshWeekResults, loading } = useContext(LeagueContext);
  const [weekInput, setWeekInput] = useState('1');
  const [syncing, setSyncing] = useState(false);

  if (loading) return <div className="text-emerald-400 text-center font-semibold">Loading data...</div>;

  const handleSyncWeekly = async () => {
    setSyncing(true);
    try {
      await refreshWeekResults(weekInput);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      if (errorMessage.includes('Incomplete scores')) {
        alert(`Week ${weekInput} data not available yet. Scores may not be complete or the week hasn't been played. Try a different week or wait until the week completes.`);
      } else {
        alert(`Error fetching week data: ${errorMessage}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  // Compile individual member payouts ledger
  const compiledPayouts = members.map(m => {
    const memberWeeklyEarnings = weekly.reduce((acc, w) => {
      let sum = acc;
      if (w.first_user_id === m.sleeper_user_id) sum += w.first_payout;
      if (w.second_user_id === m.sleeper_user_id) sum += w.second_payout;
      return sum;
    }, 0);

    return {
      id: m.id,
      name: m.name,
      paid: m.total_paid || 0,
      weeklyEarned: memberWeeklyEarnings,
      netTotal: memberWeeklyEarnings - (250.0 - (m.total_paid || 0)),
      survivor_opted_in: m.survivor_opted_in,
      chopped_opted_in: m.chopped_opted_in,
      survivor_paid: m.survivor_paid,
      chopped_paid: m.chopped_paid
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-emerald-400">Payout Ledger</h2>
        <div className="flex bg-slate-800 p-2 rounded items-center gap-2 border border-slate-700">
          <label className="text-sm text-slate-400">Sync Week (1-14):</label>
          <input type="number" min="1" max="14" className="w-16 bg-slate-900 border border-slate-700 text-center rounded p-1 text-slate-100" value={weekInput} onChange={e => setWeekInput(e.target.value)} />
          <button className="bg-emerald-500 hover:bg-emerald-600 font-semibold px-3 py-1 rounded text-slate-900 text-sm disabled:opacity-50" onClick={handleSyncWeekly} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Fetch'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Total Balance Ledger</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-2">Owner Name</th>
              <th className="py-2">Dues Paid</th>
              <th className="py-2">Weekly Earnings</th>
              <th className="py-2">Net Balance</th>
              <th className="py-2">Survivor ($50)</th>
              <th className="py-2">Chopped ($25)</th>
            </tr>
          </thead>
          <tbody>
            {compiledPayouts.map(cp => (
              <tr key={cp.id} className="border-b border-slate-800">
                <td className="py-3 font-semibold">{cp.name}</td>
                <td className="py-3 text-slate-305">${cp.paid}</td>
                <td className="py-3 text-emerald-400 font-medium">${cp.weeklyEarned}</td>
                <td className="py-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${cp.netTotal >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-450'}`}>
                    ${cp.netTotal.toFixed(2)}
                  </span>
                </td>
                <td className="py-3"><LeagueStatusBadge member={cp} league="survivor" /></td>
                <td className="py-3"><LeagueStatusBadge member={cp} league="chopped" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Sync logs per week</h3>
        {weekly.length === 0 ? (
          <div className="text-slate-500 italic block py-4 text-center">No weekly results loaded yet</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2">Week</th>
                <th className="py-2">1st Place ($17)</th>
                <th className="py-2">2nd Place ($8)</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map(w => (
                <tr key={w.id} className="border-b border-slate-800">
                  <td className="py-3 font-semibold">Week {w.week}</td>
                  <td className="py-3">{w.first_name} ({w.first_points.toFixed(2)} pts)</td>
                  <td className="py-3">{w.second_name} ({w.second_points.toFixed(2)} pts)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
