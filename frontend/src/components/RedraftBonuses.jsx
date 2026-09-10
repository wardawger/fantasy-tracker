import React, { useContext, useMemo } from 'react';
import { LeagueContext } from '../context/LeagueContext';

export default function RedraftBonuses() {
  const { members, weekly, loading } = useContext(LeagueContext);

  if (loading) return <div className="text-emerald-400 text-center font-semibold">Loading data...</div>;

  // Calculate season-long bonus leaders
  const bonusLeaders = useMemo(() => {
    // Best Record - most wins
    const recordLeader = members.reduce((best, member) => {
      // This will be updated when we fetch actual standings from Sleeper
      return best; // Placeholder
    }, null);

    // Highest Single Week Score
    const highestWeekScore = weekly.reduce((highest, week) => {
      if (!highest || week.first_points > highest.points) {
        return {
          user_id: week.first_user_id,
          name: week.first_name,
          points: week.first_points,
          week: week.week
        };
      }
      return highest;
    }, null);

    // Most Total Season Points
    const seasonPointsLeaders = members.map(member => {
      const totalPoints = weekly.reduce((sum, week) => {
        if (week.first_user_id === member.sleeper_user_id) {
          sum += week.first_points;
        } else if (week.second_user_id === member.sleeper_user_id) {
          sum += week.second_points;
        }
        return sum;
      }, 0);

      return {
        user_id: member.sleeper_user_id,
        name: member.name,
        totalPoints
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints)[0];

    return {
      recordLeader,
      highestWeekScore,
      seasonPointsLeader: seasonPointsLeaders
    };
  }, [members, weekly]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold text-emerald-400">Redraft League Bonuses</h2>
        <div className="text-sm text-slate-400">Updated through Week {weekly.length > 0 ? Math.max(...weekly.map(w => w.week)) : 0}</div>
      </div>

      {/* Weekly Winners Table */}
      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Weekly Payouts (Weeks 1-14)</h3>
        <div className="text-sm text-slate-400 mb-4">
          First place each week: $17 | Second place each week: $8
        </div>
        {weekly.length === 0 ? (
          <div className="text-slate-500 italic block py-4 text-center">No weekly results yet. Use Payout Ledger to sync weeks.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse border border-slate-700">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 divide-x divide-slate-700">
                  <th className="py-2 px-3 whitespace-nowrap">Week</th>
                  <th className="py-2 px-3 whitespace-nowrap">1st Place</th>
                  <th className="py-2 px-3 whitespace-nowrap">Score</th>
                  <th className="py-2 px-3 whitespace-nowrap">Payout</th>
                  <th className="py-2 px-3 whitespace-nowrap">2nd Place</th>
                  <th className="py-2 px-3 whitespace-nowrap">Score</th>
                  <th className="py-2 px-3 whitespace-nowrap">Payout</th>
                </tr>
              </thead>
              <tbody>
                {weekly.sort((a, b) => a.week - b.week).map(w => (
                  <tr key={w.id} className="border-b border-slate-800 divide-x divide-slate-800">
                    <td className="py-3 px-3 font-semibold whitespace-nowrap">Week {w.week}</td>
                    <td className="py-3 px-3 text-emerald-400 whitespace-nowrap">{w.first_name}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{w.first_points.toFixed(2)}</td>
                    <td className="py-3 px-3 text-emerald-400 font-medium whitespace-nowrap">${w.first_payout}</td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{w.second_name}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{w.second_points.toFixed(2)}</td>
                    <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">${w.second_payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Season Bonus Leaders Table */}
      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg border border-slate-700">
        <h3 className="font-semibold text-emerald-400 mb-4">Season Bonus Leaders</h3>
        <div className="text-sm text-slate-400 mb-4">
          Each bonus pays $50 at end of regular season (through Week 14)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse border border-slate-700">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 divide-x divide-slate-700">
                <th className="py-2 px-3 whitespace-nowrap">Bonus Category</th>
                <th className="py-2 px-3 whitespace-nowrap">Current Leader</th>
                <th className="py-2 px-3 whitespace-nowrap">Record/Score</th>
                <th className="py-2 px-3 whitespace-nowrap">Payout</th>
                <th className="py-2 px-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800 divide-x divide-slate-800">
                <td className="py-3 px-3 font-semibold whitespace-nowrap">Best Regular Season Record</td>
                <td className="py-3 px-3 text-slate-400 italic whitespace-nowrap">TBD - standings not synced</td>
                <td className="py-3 px-3 whitespace-nowrap">-</td>
                <td className="py-3 px-3 text-emerald-400 font-medium whitespace-nowrap">$50</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">Pending</span>
                </td>
              </tr>
              <tr className="border-b border-slate-800 divide-x divide-slate-800">
                <td className="py-3 px-3 font-semibold whitespace-nowrap">Highest Single Week Score</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.highestWeekScore ? (
                    <span className="text-emerald-400">{bonusLeaders.highestWeekScore.name}</span>
                  ) : (
                    <span className="text-slate-400 italic">No data yet</span>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.highestWeekScore ? (
                    <>
                      {bonusLeaders.highestWeekScore.points.toFixed(2)} pts <span className="text-slate-500">(Week {bonusLeaders.highestWeekScore.week})</span>
                    </>
                  ) : '-'}
                </td>
                <td className="py-3 px-3 text-emerald-400 font-medium whitespace-nowrap">$50</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.highestWeekScore ? (
                    <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">Leading</span>
                  ) : (
                    <span className="bg-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">No Data</span>
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-800 divide-x divide-slate-800">
                <td className="py-3 px-3 font-semibold whitespace-nowrap">Most Total Season Points</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.seasonPointsLeader && bonusLeaders.seasonPointsLeader.totalPoints > 0 ? (
                    <span className="text-emerald-400">{bonusLeaders.seasonPointsLeader.name}</span>
                  ) : (
                    <span className="text-slate-400 italic">No data yet</span>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.seasonPointsLeader && bonusLeaders.seasonPointsLeader.totalPoints > 0
                    ? `${bonusLeaders.seasonPointsLeader.totalPoints.toFixed(2)} pts`
                    : '-'}
                </td>
                <td className="py-3 px-3 text-emerald-400 font-medium whitespace-nowrap">$50</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {bonusLeaders.seasonPointsLeader && bonusLeaders.seasonPointsLeader.totalPoints > 0 ? (
                    <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">Leading</span>
                  ) : (
                    <span className="bg-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">No Data</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-slate-500 italic">
          * Season bonus leaders will be finalized after Week 14 regular season completion
        </div>
      </div>
    </div>
  );
}
