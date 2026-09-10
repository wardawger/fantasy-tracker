import React, { useContext, useState } from 'react';
import { LeagueContext } from '../context/LeagueContext';
import { useSortableData } from '../hooks/useSortableData';
import SortableTh from './SortableTh';

const LEAGUE_DUES = { main: 250, survivor: 50, chopped: 25 };
const LEAGUE_LABELS = { main: 'Main League ($250)', survivor: 'Survivor ($50)', chopped: 'Chopped ($25)' };

export default function Payments() {
  const { members, payments, addPayment, deletePayment, updatePayment, optIn, setVenmoUsername, loading } = useContext(LeagueContext);
  const [memberId, setMemberId] = useState('');
  const [venmoInput, setVenmoInput] = useState('');
  const [amount, setAmount] = useState('');
  const [league, setLeague] = useState('main');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('Venmo');
  const [notes, setNotes] = useState('');

  // Password protection
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editLeague, setEditLeague] = useState('main');
  const [editDate, setEditDate] = useState('');
  const [editMethod, setEditMethod] = useState('Venmo');
  const [editNotes, setEditNotes] = useState('');
  const [editVenmoInput, setEditVenmoInput] = useState('');

  const { items: sortedPayments, sortKey: paymentsSortKey, sortDirection: paymentsSortDirection, requestSort: requestPaymentsSort } = useSortableData(payments, 'date', 'desc');

  const CORRECT_PASSWORD = 'Dtwd6080!';

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  // Show password prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 w-full max-w-md">
          <h2 className="text-2xl font-bold text-emerald-400 mb-4">🔒 Protected Page</h2>
          <p className="text-slate-400 mb-6">Enter the password to access payment management.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Password</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                placeholder="Enter password"
                autoFocus
              />
              {passwordError && (
                <p className="text-rose-500 text-sm mt-2">❌ Incorrect password. Please try again.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-semibold rounded text-slate-900 transition"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-emerald-400 text-center font-semibold">Loading data...</div>;

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

  const startEdit = (p) => {
    setEditingPaymentId(p.id);
    setEditAmount(String(p.amount));
    setEditLeague(p.league);
    setEditDate(p.date);
    setEditMethod(p.method);
    setEditNotes(p.notes || '');
    setEditVenmoInput(members.find(m => m.id === p.member_id)?.venmo_username || '');
  };

  const cancelEdit = () => setEditingPaymentId(null);

  const handleEditSave = async (id) => {
    if (!editAmount) return alert('Enter an amount');
    await updatePayment(id, {
      amount: parseFloat(editAmount),
      date: editDate,
      method: editMethod,
      notes: editNotes,
      league: editLeague
    });
    setEditingPaymentId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-emerald-400">Record Payments</h2>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-sm text-slate-400 hover:text-emerald-400 transition"
        >
          🔒 Lock Page
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-fit space-y-4">
          <h3 className="font-semibold text-emerald-400">Add Payment Receipt</h3>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Select Member</label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
              value={memberId}
              onChange={e => {
                const newMemberId = e.target.value;
                setMemberId(newMemberId);
                setVenmoInput(members.find(m => m.id === newMemberId)?.venmo_username || '');
              }}
            >
              <option value="">-- Choose member --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {memberId && (
            <>
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
              <div>
                <label className="block text-sm text-slate-400 mb-1">Venmo Username</label>
                <input
                  type="text"
                  placeholder="e.g. john-smith-42"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                  value={venmoInput}
                  onChange={e => setVenmoInput(e.target.value)}
                  onBlur={() => setVenmoUsername(memberId, venmoInput.trim())}
                />
              </div>
            </>
          )}
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
          <div>
            <label className="block text-sm text-slate-400 mb-1">Dues Amount</label>
            <input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="Venmo">Venmo</option>
              <option value="Cash">Cash</option>
              <option value="Zelle">Zelle</option>
              <option value="Check">Check</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Payment Date</label>
            <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Commentary / Notes</label>
            <textarea className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
          </div>
          <button type="submit" className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 font-semibold rounded text-slate-900 transition">Save Payment</button>
        </form>

        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="font-semibold text-emerald-400 mb-4">Dues payment history</h3>
          <div className="overflow-y-auto max-h-[500px]">
            {payments.length === 0 ? (
              <div className="text-slate-500 italic block py-4 text-center">No payment entries found</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <SortableTh label="Date" sortKey="date" currentKey={paymentsSortKey} direction={paymentsSortDirection} onSort={requestPaymentsSort} />
                    <SortableTh label="Owner" sortKey="member_name" currentKey={paymentsSortKey} direction={paymentsSortDirection} onSort={requestPaymentsSort} />
                    <SortableTh label="Amount" sortKey="amount" currentKey={paymentsSortKey} direction={paymentsSortDirection} onSort={requestPaymentsSort} />
                    <SortableTh label="League" sortKey="league" currentKey={paymentsSortKey} direction={paymentsSortDirection} onSort={requestPaymentsSort} />
                    <SortableTh label="Protocol" sortKey="method" currentKey={paymentsSortKey} direction={paymentsSortDirection} onSort={requestPaymentsSort} />
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map(p => (
                    <React.Fragment key={p.id}>
                      <tr
                        className="border-b border-slate-800 hover:bg-slate-700/50 cursor-pointer transition"
                        onClick={() => setExpandedPaymentId(expandedPaymentId === p.id ? null : p.id)}
                      >
                        <td className="py-3">{p.date}</td>
                        <td className="py-3 font-semibold">{p.member_name}</td>
                        <td className="py-3 text-emerald-400 font-medium">${p.amount}</td>
                        <td className="py-3"><span className="bg-slate-700 px-2 py-0.5 rounded text-xs capitalize">{p.league}</span></td>
                        <td className="py-3"><span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{p.method}</span></td>
                        <td className="py-3">
                          <button
                            className="text-emerald-400 hover:text-emerald-300 hover:underline mr-3"
                            onClick={(e) => { e.stopPropagation(); startEdit(p); setExpandedPaymentId(p.id); }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-rose-500 hover:text-rose-450 hover:underline mr-3"
                            onClick={(e) => { e.stopPropagation(); deletePayment(p.id); }}
                          >
                            Delete
                          </button>
                          <span className="text-slate-500 text-xs">
                            {expandedPaymentId === p.id ? '▼' : '▶'}
                          </span>
                        </td>
                      </tr>
                      {expandedPaymentId === p.id && editingPaymentId === p.id && (
                        <tr className="bg-slate-700/30">
                          <td colSpan="6" className="py-4 px-6">
                            <div className="space-y-3 text-sm max-w-sm">
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={!!members.find(m => m.id === p.member_id)?.survivor_opted_in}
                                    onChange={e => optIn(p.member_id, 'survivor', e.target.checked)}
                                  />
                                  Survivor
                                </label>
                                <label className="flex items-center gap-2 text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={!!members.find(m => m.id === p.member_id)?.chopped_opted_in}
                                    onChange={e => optIn(p.member_id, 'chopped', e.target.checked)}
                                  />
                                  Chopped
                                </label>
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Venmo Username</label>
                                <input
                                  type="text"
                                  placeholder="e.g. john-smith-42"
                                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100"
                                  value={editVenmoInput}
                                  onChange={e => setEditVenmoInput(e.target.value)}
                                  onBlur={() => setVenmoUsername(p.member_id, editVenmoInput.trim())}
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Amount</label>
                                <input type="number" step="any" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">League</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={editLeague} onChange={e => setEditLeague(e.target.value)}>
                                  {Object.keys(LEAGUE_DUES).map(l => (
                                    <option key={l} value={l}>{LEAGUE_LABELS[l]}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Payment Method</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={editMethod} onChange={e => setEditMethod(e.target.value)}>
                                  <option value="Venmo">Venmo</option>
                                  <option value="Cash">Cash</option>
                                  <option value="Zelle">Zelle</option>
                                  <option value="Check">Check</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Payment Date</label>
                                <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={editDate} onChange={e => setEditDate(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Commentary / Notes</label>
                                <textarea className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={editNotes} onChange={e => setEditNotes(e.target.value)}></textarea>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 font-semibold rounded text-slate-900 transition"
                                  onClick={() => handleEditSave(p.id)}
                                >
                                  Save
                                </button>
                                <button
                                  className="py-2 px-4 bg-slate-700 hover:bg-slate-600 font-semibold rounded text-slate-100 transition"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {expandedPaymentId === p.id && editingPaymentId !== p.id && (
                        <tr className="bg-slate-700/30">
                          <td colSpan="6" className="py-4 px-6">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">Payment ID:</span>
                                <span className="text-slate-300 font-mono text-xs">{p.id}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">Member:</span>
                                <span className="text-slate-300">{p.member_name}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">Amount:</span>
                                <span className="text-emerald-400 font-semibold">${p.amount}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">League:</span>
                                <span className="text-slate-300 capitalize">{p.league}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">Date:</span>
                                <span className="text-slate-300">{p.date}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-slate-400 font-medium w-24">Method:</span>
                                <span className="text-slate-300">{p.method}</span>
                              </div>
                              {p.notes && (
                                <div className="flex items-start">
                                  <span className="text-slate-400 font-medium w-24">Notes:</span>
                                  <span className="text-slate-300 italic">{p.notes}</span>
                                </div>
                              )}
                              {!p.notes && (
                                <div className="flex items-start">
                                  <span className="text-slate-400 font-medium w-24">Notes:</span>
                                  <span className="text-slate-500 italic">No notes provided</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
