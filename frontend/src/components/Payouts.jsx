import React, { useContext, useState } from 'react';
import { LeagueContext } from '../context/LeagueContext';
import { useSortableData } from '../hooks/useSortableData';
import SortableTh from './SortableTh';

const LEAGUE_DUES = { survivor: 50, chopped: 25 };

function venmoPayLink(username, amount, note) {
  return `https://venmo.com/${encodeURIComponent(username)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
}

function VenmoPayButton({ username, amount, note }) {
  if (!username) return null;
  return (
    <a
      href={venmoPayLink(username, amount, note)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1 bg-[#3D95CE] hover:bg-[#3483B5] font-semibold px-3 py-1 rounded text-white text-sm whitespace-nowrap"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M20.6 3.2c.7 1.2 1 2.4 1 4 0 5-4.3 11.5-7.7 16.1H6.4L3.3 4.4l6.2-.6 1.6 13.2c1.5-2.5 3.4-6.4 3.4-9 0-1.5-.3-2.5-.7-3.3z"/>
      </svg>
      Pay with Venmo
    </a>
  );
}

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
  const { members, weekly, champions, refreshWeekResults, refreshChampion, loading } = useContext(LeagueContext);
  const [weekInput, setWeekInput] = useState('1');
  const [syncing, setSyncing] = useState(false);
  const [syncingChampion, setSyncingChampion] = useState(null);

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

  const { items: sortedPayouts, sortKey: payoutsSortKey, sortDirection: payoutsSortDirection, requestSort: requestPayoutsSort } = useSortableData(compiledPayouts, 'name', 'asc');

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

  const handleSyncChampion = async (league) => {
    setSyncingChampion(league);
    try {
      await refreshChampion(league);
    } catch (err) {
      alert(`Error fetching ${league} champion: ${err.response?.data?.error || err.message}`);
    } finally {
      setSyncingChampion(null);
    }
  };

  const championByLeague = Object.fromEntries(champions.map(c => [c.league, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold text-emerald-400">Payout Ledger</h2>
        <div className="flex flex-wrap bg-slate-800 p-2 rounded items-center gap-2 border border-slate-700">
          <label className="text-sm text-slate-400">Sync Week (1-14):</label>
          <input type="number" min="1" max="14" className="w-16 bg-slate-900 border border-slate-700 text-center rounded p-1 text-slate-100" value={weekInput} onChange={e => setWeekInput(e.target.value)} />
          <button className="bg-emerald-500 hover:bg-emerald-600 font-semibold px-3 py-1 rounded text-slate-900 text-sm disabled:opacity-50" onClick={handleSyncWeekly} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Fetch'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Total Balance Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <SortableTh label="Owner Name" sortKey="name" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} className="pr-4" />
                <SortableTh label="Dues Paid" sortKey="paid" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} className="pr-4" />
                <SortableTh label="Weekly Earnings" sortKey="weeklyEarned" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} className="pr-4" />
                <SortableTh label="Net Balance" sortKey="netTotal" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} className="pr-4" />
                <SortableTh label="Survivor ($50)" sortKey="survivor_paid" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} className="pr-4" />
                <SortableTh label="Chopped ($25)" sortKey="chopped_paid" currentKey={payoutsSortKey} direction={payoutsSortDirection} onSort={requestPayoutsSort} />
              </tr>
            </thead>
            <tbody>
              {sortedPayouts.map(cp => (
                <tr key={cp.id} className="border-b border-slate-800">
                  <td className="py-3 pr-4 font-semibold whitespace-nowrap">{cp.name}</td>
                  <td className="py-3 pr-4 text-slate-305 whitespace-nowrap">${cp.paid}</td>
                  <td className="py-3 pr-4 text-emerald-400 font-medium whitespace-nowrap">${cp.weeklyEarned}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${cp.netTotal >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-450'}`}>
                      ${cp.netTotal.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap"><LeagueStatusBadge member={cp} league="survivor" /></td>
                  <td className="py-3 whitespace-nowrap"><LeagueStatusBadge member={cp} league="chopped" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">League Champions (Winner Take All)</h3>
        <div className="space-y-3">
          {['survivor', 'chopped'].map(league => {
            const champion = championByLeague[league];
            const winnerMember = champion?.decided ? members.find(m => m.sleeper_user_id === champion.winner_user_id) : null;
            return (
              <div key={league} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-semibold capitalize w-20">{league}</span>
                  {champion?.decided ? (
                    <span className="text-slate-100 font-medium">{champion.winner_name}</span>
                  ) : (
                    <span className="text-slate-500 italic">Not yet decided</span>
                  )}
                  <span className="text-emerald-400 font-medium">
                    {champion?.decided ? `$${champion.payout}` : '—'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="bg-emerald-500 hover:bg-emerald-600 font-semibold px-3 py-1 rounded text-slate-900 text-sm disabled:opacity-50"
                    onClick={() => handleSyncChampion(league)}
                    disabled={syncingChampion === league}
                  >
                    {syncingChampion === league ? 'Checking...' : 'Check for Winner'}
                  </button>
                  {champion?.decided && (
                    <VenmoPayButton username={winnerMember?.venmo_username} amount={champion.payout} note={`${league} champion payout`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Sync logs per week</h3>
        {weekly.length === 0 ? (
          <div className="text-slate-500 italic block py-4 text-center">No weekly results loaded yet</div>
        ) : (
          <div className="space-y-4">
            {weekly.map(w => {
              const firstMember = members.find(m => m.sleeper_user_id === w.first_user_id);
              const secondMember = members.find(m => m.sleeper_user_id === w.second_user_id);
              return (
                <div key={w.id} className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0">
                  <div className="font-semibold mb-2">Week {w.week}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400">1st ($17):</span>
                      <span className="whitespace-nowrap">{w.first_name} ({w.first_points.toFixed(2)} pts)</span>
                      <VenmoPayButton username={firstMember?.venmo_username} amount={w.first_payout} note={`Week ${w.week} Redraft - 1st place`} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400">2nd ($8):</span>
                      <span className="whitespace-nowrap">{w.second_name} ({w.second_points.toFixed(2)} pts)</span>
                      <VenmoPayButton username={secondMember?.venmo_username} amount={w.second_payout} note={`Week ${w.week} Redraft - 2nd place`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
