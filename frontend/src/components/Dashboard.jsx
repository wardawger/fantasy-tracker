import React, { useContext } from 'react';
import { LeagueContext } from '../context/LeagueContext';
import { useSortableData } from '../hooks/useSortableData';
import SortableTh from './SortableTh';

const LEAGUE_DUES = { survivor: 50, chopped: 25 };

function LeagueStatusBadge({ member, league }) {
  const optedIn = league === 'survivor' ? member.survivor_opted_in : member.chopped_opted_in;
  const paid = league === 'survivor' ? member.survivor_paid : member.chopped_paid;

  if (!optedIn) {
    return <span className="bg-slate-700 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Opted Out</span>;
  }
  if (paid >= LEAGUE_DUES[league]) {
    return <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Paid</span>;
  }
  if (paid > 0) {
    return <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Partially Paid</span>;
  }
  return <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Unpaid</span>;
}

export default function Dashboard() {
  const { members, weekly, loading } = useContext(LeagueContext);
  const { items: sortedMembers, sortKey: membersSortKey, sortDirection: membersSortDirection, requestSort: requestMembersSort } = useSortableData(members, 'name', 'asc');

  if (loading) return <div className="text-emerald-400 text-center font-semibold">Loading data...</div>;

  const totalOwed = members.length * 250;
  const totalPaid = members.reduce((acc, m) => acc + (m.total_paid || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emerald-400">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">Total Pot</div>
          <div className="text-3xl font-bold mt-1 text-slate-100">${totalOwed}</div>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">Dues Collected</div>
          <div className="text-3xl font-bold mt-1 text-emerald-400">${totalPaid}</div>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">Outstanding Balance</div>
          <div className="text-3xl font-bold mt-1 text-rose-500">${totalOwed - totalPaid}</div>
        </div>
      </div>
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-emerald-400">Payments Health Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-350 border-collapse border border-slate-700">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 divide-x divide-slate-700">
                <SortableTh label="Team Owner" sortKey="name" currentKey={membersSortKey} direction={membersSortDirection} onSort={requestMembersSort} className="px-3" />
                <SortableTh label="Dues Status ($250)" sortKey="total_paid" currentKey={membersSortKey} direction={membersSortDirection} onSort={requestMembersSort} className="px-3" />
                <SortableTh label="Survivor ($50)" sortKey="survivor_paid" currentKey={membersSortKey} direction={membersSortDirection} onSort={requestMembersSort} className="px-3" />
                <SortableTh label="Chopped ($25)" sortKey="chopped_paid" currentKey={membersSortKey} direction={membersSortDirection} onSort={requestMembersSort} className="px-3" />
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map(m => (
                <tr key={m.id} className="border-b border-slate-800 divide-x divide-slate-800">
                  <td className="py-3 px-3 font-semibold whitespace-nowrap">{m.name}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {m.total_paid >= 250 ? (
                      <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Fully Paid</span>
                    ) : m.total_paid > 0 ? (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Partially Paid</span>
                    ) : (
                      <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Unpaid</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap"><LeagueStatusBadge member={m} league="survivor" /></td>
                  <td className="py-3 px-3 whitespace-nowrap"><LeagueStatusBadge member={m} league="chopped" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
