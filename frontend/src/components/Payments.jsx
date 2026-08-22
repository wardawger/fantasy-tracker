import React, { useContext, useState } from 'react';
import { LeagueContext } from '../context/LeagueContext';

export default function Payments() {
  const { members, payments, addPayment, deletePayment, loading } = useContext(LeagueContext);
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('Venmo');
  const [notes, setNotes] = useState('');

  if (loading) return <div className="text-emerald-400 text-center font-semibold">Loading data...</div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId || !amount) return alert('Select owner and amount');
    await addPayment({
      memberId,
      amount: parseFloat(amount),
      date,
      method,
      notes
    });
    setAmount('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-emerald-400">Record Payments</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-fit space-y-4">
          <h3 className="font-semibold text-emerald-400">Add Payment Receipt</h3>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Select Member</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100" value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">-- Choose member --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
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
                    <th className="py-2">Date</th>
                    <th className="py-2">Owner</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Protocol</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-slate-800">
                      <td className="py-3">{p.date}</td>
                      <td className="py-3 font-semibold">{p.member_name}</td>
                      <td className="py-3 text-emerald-400 font-medium">${p.amount}</td>
                      <td className="py-3"><span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{p.method}</span></td>
                      <td className="py-3">
                        <button className="text-rose-500 hover:text-rose-450 hover:underline" onClick={() => deletePayment(p.id)}>Delete</button>
                      </td>
                    </tr>
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
